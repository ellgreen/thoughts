package store

import (
	"context"
	"errors"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/internal/db"
	"github.com/ellgreen/thoughts/migrations"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "thoughts.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = d.Close() })
	if err := db.Migrate(context.Background(), d, migrations.FS); err != nil {
		t.Fatal(err)
	}
	return New(d)
}

func TestNameSignInIsANewUserEveryTime(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	a, err := s.SignIn(ctx, Identity{Provider: "name", Name: "Alex"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.SignIn(ctx, Identity{Provider: "name", Name: "Alex"})
	if err != nil {
		t.Fatal(err)
	}
	if a.ID == b.ID {
		t.Fatal("two people called Alex became one user")
	}
}

func TestSubjectSignInReturnsTheSameUserWithTheNewName(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	first, err := s.SignIn(ctx, Identity{Provider: "ldap", Subject: "uid=alex,dc=example", Name: "Alex"})
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.SignIn(ctx, Identity{Provider: "ldap", Subject: "uid=alex,dc=example", Name: "Alex Smith"})
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != first.ID || again.Name != "Alex Smith" {
		t.Fatalf("first = %+v, again = %+v", first, again)
	}
	other, _ := s.SignIn(ctx, Identity{Provider: "oidc", Subject: "uid=alex,dc=example", Name: "Alex"})
	if other.ID == first.ID {
		t.Fatal("the same subject from another driver was treated as the same person")
	}
}

func TestSessions(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	start := time.Date(2026, 10, 21, 9, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return start }

	u, _ := s.SignIn(ctx, Identity{Provider: "name", Name: "Sam"})
	token, err := s.CreateSession(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	got, err := s.UserBySession(ctx, token)
	if err != nil || got.ID != u.ID {
		t.Fatalf("got %+v, %v", got, err)
	}

	s.now = func() time.Time { return start.Add(SessionLifetime + time.Second) }
	if _, err := s.UserBySession(ctx, token); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expired session: %v", err)
	}

	s.now = func() time.Time { return start }
	if err := s.DeleteSession(ctx, token); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UserBySession(ctx, token); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted session: %v", err)
	}
}

func TestNewIDIsAUUIDv7(t *testing.T) {
	now := time.Date(2026, 10, 21, 9, 0, 0, 0, time.UTC)
	id := newID(now)
	if !regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(id) {
		t.Fatalf("id = %s", id)
	}
	prev := id
	for range 5000 {
		next := newID(now)
		if next <= prev {
			t.Fatalf("%s does not sort after %s", next, prev)
		}
		prev = next
	}
}
