package config

import (
	"slices"
	"strings"
	"testing"

	"github.com/ellgreen/thoughts/internal/logging"
)

func TestDefaultsMatchV1(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Address != "localhost:3000" || cfg.DatabasePath() != "data/thoughts.sqlite" || cfg.SessionKeyPath() != "data/session.key" {
		t.Fatalf("cfg = %+v", cfg)
	}
	if !slices.Equal(cfg.Auth, []string{"name"}) || cfg.TLS() {
		t.Fatalf("auth = %v, tls = %v", cfg.Auth, cfg.TLS())
	}
}

func TestAuth(t *testing.T) {
	tests := []struct {
		in      string
		want    []string
		wantErr bool
	}{
		{"name", []string{"name"}, false},
		{" Name , name", []string{"name"}, false},
		{"", nil, true},
		{"passwords", nil, true},
	}
	for _, tt := range tests {
		got, err := auth(tt.in)
		if (err != nil) != tt.wantErr || !slices.Equal(got, tt.want) {
			t.Errorf("auth(%q) = %v, %v", tt.in, got, err)
		}
	}
}

func TestTLSNeedsBothPaths(t *testing.T) {
	t.Setenv("THOUGHTS_TLS_CERT_PATH", "cert.pem")
	cfg, _ := Load()
	if cfg.TLS() {
		t.Fatal("TLS on with only a certificate")
	}
	t.Setenv("THOUGHTS_TLS_KEY_PATH", "key.pem")
	if cfg, _ = Load(); !cfg.TLS() {
		t.Fatal("TLS off with both paths")
	}
}

func TestLogFormat(t *testing.T) {
	t.Setenv("THOUGHTS_LOG_FORMAT", "json")
	if cfg, err := Load(); err != nil || cfg.LogFormat != logging.JSON {
		t.Fatalf("json = %q, %v", cfg.LogFormat, err)
	}
	t.Setenv("THOUGHTS_LOG_FORMAT", "yaml")
	if _, err := Load(); err == nil {
		t.Fatal("expected an error for an unknown format")
	}
}

func TestLDAPRefusesPlaintextPasswords(t *testing.T) {
	t.Setenv("THOUGHTS_AUTH", "name,ldap")
	t.Setenv("THOUGHTS_LDAP_BIND", "uid={username},ou=people,dc=example,dc=org")
	t.Setenv("THOUGHTS_LDAP_URL", "ldap://ldap.example.org")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "in the clear") {
		t.Fatalf("plain ldap: %v", err)
	}
	t.Setenv("THOUGHTS_LDAP_STARTTLS", "true")
	if cfg, err := Load(); err != nil || cfg.LDAP.Label != "Company account" {
		t.Fatalf("starttls: %+v, %v", cfg.LDAP, err)
	}
	t.Setenv("THOUGHTS_LDAP_BIND", "uid=alex,ou=people")
	if _, err := Load(); err == nil {
		t.Fatal("a bind template without {username} was accepted")
	}
}

func TestOIDCNeedsAPublicURL(t *testing.T) {
	t.Setenv("THOUGHTS_AUTH", "oidc")
	t.Setenv("THOUGHTS_OIDC_ISSUER", "https://id.example.com")
	t.Setenv("THOUGHTS_OIDC_CLIENT_ID", "thoughts")
	t.Setenv("THOUGHTS_OIDC_SCOPES", "profile,email")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "THOUGHTS_PUBLIC_URL") {
		t.Fatalf("err = %v", err)
	}
	t.Setenv("THOUGHTS_PUBLIC_URL", "https://thoughts.example.com/")
	cfg, err := Load()
	if err != nil || cfg.PublicURL != "https://thoughts.example.com" || !slices.Equal(cfg.OIDC.Scopes, []string{"openid", "profile", "email"}) {
		t.Fatalf("%+v, %v", cfg, err)
	}
}

func TestAI(t *testing.T) {
	cfg, err := Load()
	if err != nil || cfg.AI.Driver != "" {
		t.Fatalf("off by default: %+v, %v", cfg.AI, err)
	}
	t.Setenv("THOUGHTS_OPENAI_API_KEY", "sk-v1")
	if cfg, err = Load(); err != nil || cfg.AI.Driver != "openai" || cfg.AI.APIKey != "sk-v1" {
		t.Fatalf("v1 key: %+v, %v", cfg.AI, err)
	}
	t.Setenv("THOUGHTS_AI_DRIVER", "anthropic")
	t.Setenv("THOUGHTS_AI_API_KEY", "sk-ant")
	if cfg, err = Load(); err != nil || cfg.AI.Driver != "anthropic" || cfg.AI.APIKey != "sk-ant" {
		t.Fatalf("explicit driver wins: %+v, %v", cfg.AI, err)
	}
	t.Setenv("THOUGHTS_AI_DRIVER", "openai-compatible")
	if _, err = Load(); err == nil {
		t.Fatal("openai-compatible without a base URL was accepted")
	}
	t.Setenv("THOUGHTS_AI_DRIVER", "magic")
	if _, err = Load(); err == nil {
		t.Fatal("unknown driver accepted")
	}
}
