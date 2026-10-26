package config

import (
	"cmp"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/ellgreen/thoughts/internal/logging"
)

// Every setting is an environment variable prefixed THOUGHTS_. Add new ones
// here so the full set stays in one place. Names v1 used keep their meaning,
// so an upgrade needs no config changes.
type Config struct {
	Address         string
	Verbose         bool
	LogFormat       logging.Format
	DataPath        string
	DatabaseFile    string
	SessionKeyFile  string
	TLSCertPath     string
	TLSKeyPath      string
	ShutdownTimeout time.Duration
	Auth            []string
	GIFProvider     string
	GIFAPIKey       string
	// PublicURL is where people open thoughts, such as
	// https://thoughts.example.com. OIDC needs it to build its callback.
	PublicURL string
	LDAP      LDAP
	OIDC      OIDC
	AI        AI
}

// AI turns on the AI features. Driver is empty when they're off.
type AI struct {
	Driver string
	Model  string
	APIKey string
	// BaseURL is the server for the openai-compatible driver, such as
	// http://localhost:11434/v1 for Ollama.
	BaseURL string
	// CopilotToken is a GitHub token with Copilot access; CopilotURL points
	// at a Copilot CLI already running in server mode, instead of starting
	// one from PATH.
	CopilotToken string
	CopilotURL   string
}

var aiDrivers = []string{"openai", "anthropic", "openai-compatible", "copilot"}

// LDAP signs people in by binding as them: there is no service account.
type LDAP struct {
	Label string
	URL   string
	// Bind is the identity to bind as, with {username} where the typed
	// username goes: uid={username},ou=people,dc=example,dc=org, or
	// {username}@corp.example for Active Directory.
	Bind     string
	StartTLS bool
	CAFile   string
	// AllowPlaintext permits ldap:// without StartTLS, which sends
	// passwords in the clear. Only for test directories.
	AllowPlaintext bool
	// BaseDN and UserFilter find the person's own entry when Bind isn't a
	// DN, as with Active Directory's user@domain form.
	BaseDN     string
	UserFilter string
	NameAttr   string
	// Group, when set, is the DN of a group people must be in.
	Group string
}

type OIDC struct {
	Label        string
	Issuer       string
	ClientID     string
	ClientSecret string
	Scopes       []string
	// GroupsClaim and Group, when Group is set, require that claim to
	// contain it.
	GroupsClaim string
	Group       string
}

var authDrivers = []string{"name", "ldap", "oidc"}

func Load() (Config, error) {
	cfg := Config{
		Address:         env("ADDRESS", "localhost:3000"),
		DataPath:        env("DATA_PATH", "./data"),
		DatabaseFile:    env("DATABASE_FILE", "thoughts.sqlite"),
		SessionKeyFile:  env("SESSION_KEY_FILE", "session.key"),
		TLSCertPath:     env("TLS_CERT_PATH", ""),
		TLSKeyPath:      env("TLS_KEY_PATH", ""),
		ShutdownTimeout: 10 * time.Second,
		GIFProvider:     env("GIF_PROVIDER", ""),
		GIFAPIKey:       env("GIF_API_KEY", ""),
	}

	var err error
	if cfg.Verbose, err = envBool("VERBOSE", false); err != nil {
		return cfg, err
	}
	if cfg.LogFormat, err = logging.ParseFormat(env("LOG_FORMAT", "text")); err != nil {
		return cfg, fmt.Errorf("THOUGHTS_LOG_FORMAT: %w", err)
	}
	if cfg.Auth, err = auth(env("AUTH", "name")); err != nil {
		return cfg, err
	}
	if cfg.PublicURL, err = publicURL(env("PUBLIC_URL", "")); err != nil {
		return cfg, err
	}
	if cfg.AI, err = loadAI(); err != nil {
		return cfg, err
	}
	if slices.Contains(cfg.Auth, "ldap") {
		if cfg.LDAP, err = loadLDAP(); err != nil {
			return cfg, err
		}
	}
	if slices.Contains(cfg.Auth, "oidc") {
		if cfg.OIDC, err = loadOIDC(); err != nil {
			return cfg, err
		}
		if cfg.PublicURL == "" {
			return cfg, fmt.Errorf("THOUGHTS_PUBLIC_URL is needed for OIDC sign-in, to build the address the provider sends people back to")
		}
	}
	return cfg, nil
}

func loadLDAP() (LDAP, error) {
	l := LDAP{
		Label:      env("LDAP_LABEL", "Company account"),
		URL:        env("LDAP_URL", ""),
		Bind:       env("LDAP_BIND", ""),
		CAFile:     env("LDAP_CA_FILE", ""),
		BaseDN:     env("LDAP_BASE_DN", ""),
		UserFilter: env("LDAP_USER_FILTER", "(|(userPrincipalName={bind})(uid={username})(sAMAccountName={username}))"),
		NameAttr:   env("LDAP_NAME_ATTRIBUTE", "displayName"),
		Group:      env("LDAP_GROUP", ""),
	}
	var err error
	if l.StartTLS, err = envBool("LDAP_STARTTLS", false); err != nil {
		return l, err
	}
	if l.AllowPlaintext, err = envBool("LDAP_ALLOW_PLAINTEXT", false); err != nil {
		return l, err
	}
	u, err := url.Parse(l.URL)
	if err != nil || (u.Scheme != "ldap" && u.Scheme != "ldaps") || u.Host == "" {
		return l, fmt.Errorf("THOUGHTS_LDAP_URL: %q should look like ldaps://ldap.example.com", l.URL)
	}
	if u.Scheme == "ldap" && !l.StartTLS && !l.AllowPlaintext {
		return l, fmt.Errorf("THOUGHTS_LDAP_URL is ldap:// without THOUGHTS_LDAP_STARTTLS, which would send passwords in the clear; use ldaps:// or StartTLS")
	}
	if !strings.Contains(l.Bind, "{username}") {
		return l, fmt.Errorf("THOUGHTS_LDAP_BIND needs {username} in it, like uid={username},ou=people,dc=example,dc=org")
	}
	return l, nil
}

func loadAI() (AI, error) {
	a := AI{
		Driver:       strings.ToLower(env("AI_DRIVER", "")),
		Model:        env("AI_MODEL", ""),
		APIKey:       env("AI_API_KEY", ""),
		BaseURL:      env("AI_BASE_URL", ""),
		CopilotToken: env("COPILOT_TOKEN", ""),
		CopilotURL:   env("COPILOT_URL", ""),
	}
	// v1 turned AI on with an OpenAI key alone, and that still works.
	if v1 := env("OPENAI_API_KEY", ""); v1 != "" && a.Driver == "" {
		a.Driver = "openai"
		a.APIKey = cmp.Or(a.APIKey, v1)
	}
	switch a.Driver {
	case "", "none":
		return AI{}, nil
	case "openai", "anthropic":
		if a.APIKey == "" {
			return a, fmt.Errorf("THOUGHTS_AI_DRIVER=%s needs THOUGHTS_AI_API_KEY", a.Driver)
		}
	case "openai-compatible":
		if a.BaseURL == "" || a.Model == "" {
			return a, fmt.Errorf("THOUGHTS_AI_DRIVER=openai-compatible needs THOUGHTS_AI_BASE_URL and THOUGHTS_AI_MODEL")
		}
	case "copilot":
	default:
		return a, fmt.Errorf("THOUGHTS_AI_DRIVER: %q isn't a driver; use one of %s", a.Driver, strings.Join(aiDrivers, ", "))
	}
	return a, nil
}

func loadOIDC() (OIDC, error) {
	o := OIDC{
		Label:        env("OIDC_LABEL", "Single sign-on"),
		Issuer:       env("OIDC_ISSUER", ""),
		ClientID:     env("OIDC_CLIENT_ID", ""),
		ClientSecret: env("OIDC_CLIENT_SECRET", ""),
		Scopes:       strings.Fields(strings.ReplaceAll(env("OIDC_SCOPES", "openid profile email"), ",", " ")),
		GroupsClaim:  env("OIDC_GROUPS_CLAIM", "groups"),
		Group:        env("OIDC_GROUP", ""),
	}
	if u, err := url.Parse(o.Issuer); err != nil || u.Scheme == "" || u.Host == "" {
		return o, fmt.Errorf("THOUGHTS_OIDC_ISSUER: %q should be the provider's issuer URL", o.Issuer)
	}
	if o.ClientID == "" {
		return o, fmt.Errorf("THOUGHTS_OIDC_CLIENT_ID is needed for OIDC sign-in")
	}
	if !slices.Contains(o.Scopes, "openid") {
		o.Scopes = append([]string{"openid"}, o.Scopes...)
	}
	return o, nil
}

func publicURL(v string) (string, error) {
	if v == "" {
		return "", nil
	}
	u, err := url.Parse(v)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", fmt.Errorf("THOUGHTS_PUBLIC_URL: %q should look like https://thoughts.example.com", v)
	}
	return strings.TrimRight(v, "/"), nil
}

func (c Config) DatabasePath() string {
	return filepath.Join(c.DataPath, c.DatabaseFile)
}

func (c Config) SessionKeyPath() string {
	return filepath.Join(c.DataPath, c.SessionKeyFile)
}

func (c Config) TLS() bool {
	return c.TLSCertPath != "" && c.TLSKeyPath != ""
}

func auth(v string) ([]string, error) {
	var out []string
	for d := range strings.SplitSeq(v, ",") {
		d = strings.ToLower(strings.TrimSpace(d))
		if d == "" || slices.Contains(out, d) {
			continue
		}
		if !slices.Contains(authDrivers, d) {
			return nil, fmt.Errorf("THOUGHTS_AUTH: %q is not a sign-in driver; use one or more of %s", d, strings.Join(authDrivers, ", "))
		}
		out = append(out, d)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("THOUGHTS_AUTH is empty, so nobody could sign in")
	}
	return out, nil
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv("THOUGHTS_" + key); ok {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) (bool, error) {
	v, ok := os.LookupEnv("THOUGHTS_" + key)
	if !ok {
		return fallback, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("THOUGHTS_%s: %w", key, err)
	}
	return b, nil
}
