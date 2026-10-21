package auth

import (
	"context"
	"testing"
)

func TestName(t *testing.T) {
	tests := []struct {
		in, want, problem string
	}{
		{"  Priya ", "Priya", ""},
		{"Zoë", "Zoë", ""},
		{"", "", "Add your name."},
		{"   ", "", "Add your name."},
		{"A", "", "Use at least 2 characters."},
		{"abcdefghijklmnopqrstuvwxyz0123456", "", "Use a shorter name, up to 32 characters."},
		{"Al\x00ex", "", "Use letters, numbers and punctuation only."},
	}
	for _, tt := range tests {
		id, err := Name{}.Authenticate(context.Background(), map[string]string{"name": tt.in})
		if tt.problem != "" {
			if err == nil || err.Error() != tt.problem {
				t.Errorf("%q: err = %v, want %q", tt.in, err, tt.problem)
			}
			continue
		}
		if err != nil || id.Name != tt.want || id.Subject != "" || id.Provider != "name" {
			t.Errorf("%q: %+v, %v", tt.in, id, err)
		}
	}
}
