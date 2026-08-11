package session

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
)

const (
	keyLength = 64

	// Thirty days, matching what gorilla/sessions would have used.
	sessionMaxAge = 86400 * 30
)

var ErrValueNotFound = errors.New("session: value not found")

type Provider struct {
	store sessions.Store

	// tls is set when the server terminates TLS itself. A request arriving
	// over https through a proxy is detected per request instead.
	tls bool
}

// LoadSessionProvider builds the cookie session store. tls says whether this
// server terminates TLS, which decides whether the cookie may be marked
// Secure.
func LoadSessionProvider(keyPath string, tls bool) (*Provider, error) {
	key, err := loadKey(keyPath)
	if err != nil {
		return nil, err
	}

	store := sessions.NewCookieStore(key)

	// gorilla/sessions defaults to Secure with SameSite=None, so the cookie is
	// only ever stored over https. Chrome makes an exception for
	// http://localhost; Safari does not, which left people logged out with a
	// login that looked like it had worked. Set the options ourselves.
	store.Options = defaultOptions(tls)

	return &Provider{store: store, tls: tls}, nil
}

func defaultOptions(secure bool) *sessions.Options {
	return &sessions.Options{
		Path:   "/",
		MaxAge: sessionMaxAge,
		// The session cookie is never read from JavaScript.
		HttpOnly: true,
		// Lax, not None: everything here is same-site, and None would drag the
		// Secure requirement back in with it.
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	}
}

// optionsFor allows Secure when the request itself arrived over https, so a
// deployment behind a TLS-terminating proxy still gets a Secure cookie.
func (sp *Provider) optionsFor(r *http.Request) *sessions.Options {
	return defaultOptions(sp.tls || isHTTPS(r))
}

func isHTTPS(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}

	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func loadKey(path string) ([]byte, error) {
	key, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to read key file: %w", err)
		}
	}

	if len(key) != 0 {
		return key, nil
	}

	newKey := securecookie.GenerateRandomKey(keyLength)

	if err := os.WriteFile(path, newKey, 0640); err != nil {
		return nil, fmt.Errorf("failed to write key file: %w", err)
	}

	slog.Info("generated new session key", "path", path)
	return newKey, nil
}

func (sp *Provider) Get(w http.ResponseWriter, r *http.Request) (*sessions.Session, error) {
	sess, err := sp.store.Get(r, "session")
	if sess != nil {
		// Applies to this response's cookie, whatever the store was built with.
		sess.Options = sp.optionsFor(r)
	}

	if err != nil {
		if sess == nil {
			return nil, fmt.Errorf("failed to get session: %w", err)
		}

		slog.Debug("could not decode the session cookie, starting a new one", "err", err)

		if err := sess.Save(r, w); err != nil {
			return nil, fmt.Errorf("failed to save session after retry: %w", err)
		}
	}

	return sess, nil
}

func (sp *Provider) AddUserID(w http.ResponseWriter, r *http.Request, userID uuid.UUID) error {
	sess, err := sp.Get(w, r)
	if err != nil {
		return err
	}

	sess.Values["user_id"] = userID.String()

	return sess.Save(r, w)
}

func (sp *Provider) GetUserID(w http.ResponseWriter, r *http.Request) (uuid.UUID, error) {
	sess, err := sp.Get(w, r)
	if err != nil {
		return uuid.Nil, err
	}

	if userID, ok := sess.Values["user_id"].(string); ok {
		return uuid.Parse(userID)
	}

	return uuid.Nil, ErrValueNotFound
}

func (sp *Provider) ForgetUserID(w http.ResponseWriter, r *http.Request) error {
	sess, err := sp.Get(w, r)
	if err != nil {
		return err
	}

	delete(sess.Values, "user_id")

	return sess.Save(r, w)
}
