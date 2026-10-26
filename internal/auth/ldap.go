package auth

import (
	"cmp"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-ldap/ldap/v3"

	"github.com/ellgreen/thoughts/internal/config"
	"github.com/ellgreen/thoughts/internal/store"
)

const ldapTimeout = 10 * time.Second

// LDAP signs people in by binding to the directory as them. It needs no
// service account: once bound, it reads the person's own entry for their
// name and, if a group is required, checks they're in it.
type LDAP struct {
	cfg config.LDAP
	tls *tls.Config
}

func NewLDAP(cfg config.LDAP) (*LDAP, error) {
	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}
	tc := &tls.Config{ServerName: u.Hostname(), MinVersion: tls.VersionTLS12}
	if cfg.CAFile != "" {
		pem, err := os.ReadFile(cfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("THOUGHTS_LDAP_CA_FILE: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("THOUGHTS_LDAP_CA_FILE: no certificates in %s", cfg.CAFile)
		}
		tc.RootCAs = pool
	}
	return &LDAP{cfg: cfg, tls: tc}, nil
}

func (l *LDAP) ID() string    { return "ldap" }
func (l *LDAP) Label() string { return l.cfg.Label }

func (l *LDAP) Fields() []Field {
	return []Field{
		{Name: "username", Label: "Username", Type: "text", Autocomplete: "username"},
		{Name: "password", Label: "Password", Type: "password", Autocomplete: "current-password"},
	}
}

func (l *LDAP) Authenticate(ctx context.Context, values map[string]string) (store.Identity, error) {
	username := strings.TrimSpace(values["username"])
	password := values["password"]
	switch {
	case username == "":
		return store.Identity{}, Problem("Add your username.")
	case utf8.RuneCountInString(username) > 256:
		return store.Identity{}, Problem("That username is too long.")
	// An empty password is an "unauthenticated bind", which many servers
	// accept as a success without checking anything.
	case password == "":
		return store.Identity{}, Problem("Add your password.")
	}

	conn, err := l.dial()
	if err != nil {
		slog.WarnContext(ctx, "ldap: connecting", "url", l.cfg.URL, "err", err)
		return store.Identity{}, Problem("Can't reach the directory to check that right now. Try again in a moment.")
	}
	defer conn.Close()

	bind := bindIdentity(l.cfg.Bind, username)
	if err := conn.Bind(bind, password); err != nil {
		if ldap.IsErrorWithCode(err, ldap.LDAPResultInvalidCredentials) {
			return store.Identity{}, Problem("That username and password didn't match.")
		}
		slog.WarnContext(ctx, "ldap: binding", "err", err)
		return store.Identity{}, Problem("The directory didn't accept that sign-in. Try again, or ask whoever runs thoughts.")
	}

	dn := l.ownDN(ctx, conn, bind, username)
	entry := l.ownEntry(ctx, conn, dn)
	if l.cfg.Group != "" && !l.inGroup(ctx, conn, entry, dn, username) {
		return store.Identity{}, Problem("Your account isn't in the group that can use thoughts here.")
	}

	name := username
	if entry != nil {
		for _, attr := range []string{l.cfg.NameAttr, "displayName", "cn"} {
			if v := strings.TrimSpace(entry.GetAttributeValue(attr)); v != "" {
				name = v
				break
			}
		}
	}
	subject := strings.ToLower(cmp.Or(dn, bind))
	return store.Identity{Provider: "ldap", Subject: subject, Name: name}, nil
}

func (l *LDAP) dial() (*ldap.Conn, error) {
	d := &net.Dialer{Timeout: ldapTimeout}
	conn, err := ldap.DialURL(l.cfg.URL, ldap.DialWithDialer(d), ldap.DialWithTLSConfig(l.tls))
	if err != nil {
		return nil, err
	}
	conn.SetTimeout(ldapTimeout)
	if l.cfg.StartTLS {
		if err := conn.StartTLS(l.tls); err != nil {
			conn.Close()
			return nil, fmt.Errorf("starttls: %w", err)
		}
	}
	return conn, nil
}

// bindIdentity puts username into the template. In a DN template it is
// escaped, so a username can't add RDNs of its own.
func bindIdentity(template, username string) string {
	if looksLikeDN(template) {
		return strings.ReplaceAll(template, "{username}", ldap.EscapeDN(username))
	}
	return strings.ReplaceAll(template, "{username}", username)
}

func looksLikeDN(s string) bool {
	_, err := ldap.ParseDN(strings.ReplaceAll(s, "{username}", "x"))
	return err == nil && strings.Contains(s, "=")
}

// ownDN finds the bound person's DN: the bind itself when it is one, then
// the server's Who Am I answer, then a search under BaseDN.
func (l *LDAP) ownDN(ctx context.Context, conn *ldap.Conn, bind, username string) string {
	if looksLikeDN(bind) {
		return bind
	}
	if who, err := conn.WhoAmI(nil); err == nil && strings.HasPrefix(who.AuthzID, "dn:") {
		return strings.TrimPrefix(who.AuthzID, "dn:")
	}
	if l.cfg.BaseDN == "" {
		return ""
	}
	filter := strings.NewReplacer("{username}", ldap.EscapeFilter(username), "{bind}", ldap.EscapeFilter(bind)).Replace(l.cfg.UserFilter)
	res, err := conn.Search(ldap.NewSearchRequest(l.cfg.BaseDN, ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 2, int(ldapTimeout/time.Second), false, filter, []string{"dn"}, nil))
	if err != nil {
		slog.WarnContext(ctx, "ldap: finding your own entry", "err", err)
		return ""
	}
	if len(res.Entries) != 1 {
		return ""
	}
	return res.Entries[0].DN
}

func (l *LDAP) ownEntry(ctx context.Context, conn *ldap.Conn, dn string) *ldap.Entry {
	if dn == "" {
		return nil
	}
	attrs := []string{"displayName", "cn", "memberOf"}
	if l.cfg.NameAttr != "" {
		attrs = append(attrs, l.cfg.NameAttr)
	}
	res, err := conn.Search(ldap.NewSearchRequest(dn, ldap.ScopeBaseObject, ldap.NeverDerefAliases, 1, int(ldapTimeout/time.Second), false, "(objectClass=*)", attrs, nil))
	if err != nil || len(res.Entries) == 0 {
		slog.WarnContext(ctx, "ldap: reading your own entry", "dn", dn, "err", err)
		return nil
	}
	return res.Entries[0]
}

// inGroup reads memberOf first, then asks the group itself, since many
// OpenLDAP servers don't maintain memberOf and some hide it from users.
func (l *LDAP) inGroup(ctx context.Context, conn *ldap.Conn, entry *ldap.Entry, dn, username string) bool {
	want, err := ldap.ParseDN(l.cfg.Group)
	if err != nil {
		slog.ErrorContext(ctx, "ldap: THOUGHTS_LDAP_GROUP isn't a DN", "group", l.cfg.Group)
		return false
	}
	if entry != nil {
		for _, g := range entry.GetAttributeValues("memberOf") {
			if got, err := ldap.ParseDN(g); err == nil && got.EqualFold(want) {
				return true
			}
		}
	}
	if dn == "" {
		return false
	}
	filter := fmt.Sprintf("(|(member=%s)(uniqueMember=%s)(memberUid=%s))", ldap.EscapeFilter(dn), ldap.EscapeFilter(dn), ldap.EscapeFilter(username))
	res, err := conn.Search(ldap.NewSearchRequest(l.cfg.Group, ldap.ScopeBaseObject, ldap.NeverDerefAliases, 1, int(ldapTimeout/time.Second), false, filter, []string{"dn"}, nil))
	if err != nil && !ldap.IsErrorWithCode(err, ldap.LDAPResultNoSuchObject) {
		slog.WarnContext(ctx, "ldap: checking the group", "group", l.cfg.Group, "err", err)
	}
	return err == nil && len(res.Entries) > 0
}
