package auth

import (
	"context"
	"os"
	"testing"

	"github.com/ellgreen/thoughts/internal/config"
)

// Live tests run against the OpenLDAP in testdata/compose.yml:
// task test:auth-live
func liveLDAP(t *testing.T, group string) *LDAP {
	t.Helper()
	if os.Getenv("THOUGHTS_AUTH_LIVE_TEST") == "" {
		t.Skip("set THOUGHTS_AUTH_LIVE_TEST=1 and run testdata/compose.yml")
	}
	l, err := NewLDAP(config.LDAP{
		URL: "ldap://127.0.0.1:1389", AllowPlaintext: true,
		Bind: "cn={username},ou=people,dc=example,dc=org", NameAttr: "displayName", Group: group,
	})
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func TestLiveLDAP(t *testing.T) {
	ctx := context.Background()
	l := liveLDAP(t, "cn=retro-people,ou=groups,dc=example,dc=org")

	id, err := l.Authenticate(ctx, map[string]string{"username": "priya", "password": "priya-password"})
	if err != nil {
		t.Fatal(err)
	}
	if id.Provider != "ldap" || id.Subject != "cn=priya,ou=people,dc=example,dc=org" || id.Name == "" {
		t.Fatalf("identity = %+v", id)
	}

	for _, tt := range []struct{ user, pass, problem string }{
		{"priya", "wrong", "That username and password didn't match."},
		{"priya", "", "Add your password."},
		{"priya,ou=people", "priya-password", "That username and password didn't match."},
		{"nobody", "x", "That username and password didn't match."},
	} {
		if _, err := l.Authenticate(ctx, map[string]string{"username": tt.user, "password": tt.pass}); err == nil || err.Error() != tt.problem {
			t.Errorf("%s/%s: %v", tt.user, tt.pass, err)
		}
	}
}

func TestLiveLDAPGroup(t *testing.T) {
	l := liveLDAP(t, "cn=admins,ou=groups,dc=example,dc=org")
	_, err := l.Authenticate(context.Background(), map[string]string{"username": "sam", "password": "sam-password"})
	if err == nil || err.Error() != "Your account isn't in the group that can use thoughts here." {
		t.Fatalf("err = %v", err)
	}
}

func TestLDAPUnreachable(t *testing.T) {
	l, _ := NewLDAP(config.LDAP{URL: "ldap://127.0.0.1:1", AllowPlaintext: true, Bind: "cn={username},dc=example"})
	_, err := l.Authenticate(context.Background(), map[string]string{"username": "priya", "password": "x"})
	if err == nil || err.Error() != "Can't reach the directory to check that right now. Try again in a moment." {
		t.Fatalf("err = %v", err)
	}
}
