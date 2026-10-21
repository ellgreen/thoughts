package auth

import (
	"context"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/ellgreen/thoughts/internal/store"
)

// Name signs people in with only a name. It never recognises anyone again:
// two people called Alex are two people.
type Name struct{}

func (Name) ID() string    { return "name" }
func (Name) Label() string { return "Just your name" }

func (Name) Fields() []Field {
	return []Field{{
		Name: "name", Label: "Your name", Type: "text", Autocomplete: "nickname",
		Help: "Only a label. Two people called Alex are two people.",
	}}
}

func (Name) Authenticate(_ context.Context, values map[string]string) (store.Identity, error) {
	name := strings.TrimSpace(values["name"])
	switch n := utf8.RuneCountInString(name); {
	case n == 0:
		return store.Identity{}, Problem("Add your name.")
	case n < 2:
		return store.Identity{}, Problem("Use at least 2 characters.")
	case n > 32:
		return store.Identity{}, Problem("Use a shorter name, up to 32 characters.")
	}
	if strings.ContainsFunc(name, unicode.IsControl) {
		return store.Identity{}, Problem("Use letters, numbers and punctuation only.")
	}
	return store.Identity{Provider: "name", Name: name}, nil
}
