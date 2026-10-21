package auth

import "testing"

func TestBindIdentity(t *testing.T) {
	tests := []struct{ template, username, want string }{
		{"uid={username},ou=people,dc=example,dc=org", "alex", "uid=alex,ou=people,dc=example,dc=org"},
		{"uid={username},ou=people,dc=example,dc=org", "alex,ou=admins", `uid=alex\,ou=admins,ou=people,dc=example,dc=org`},
		{"{username}@corp.example", "alex", "alex@corp.example"},
		{`CORP\{username}`, "alex", `CORP\alex`},
	}
	for _, tt := range tests {
		if got := bindIdentity(tt.template, tt.username); got != tt.want {
			t.Errorf("bindIdentity(%q, %q) = %q, want %q", tt.template, tt.username, got, tt.want)
		}
	}
}
