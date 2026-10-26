package auth

import (
	"context"
	"fmt"
	"net/url"

	"github.com/ellgreen/thoughts/internal/config"
	"github.com/ellgreen/thoughts/internal/store"
)

type Field struct {
	Name         string `json:"name"`
	Label        string `json:"label"`
	Type         string `json:"type"`
	Autocomplete string `json:"autocomplete,omitempty"`
	Help         string `json:"help,omitempty"`
}

type Provider interface {
	ID() string
	Label() string
}

// Form is a driver that signs people in from fields on the sign-in page:
// a name, or a username and password.
type Form interface {
	Provider
	Fields() []Field
	Authenticate(ctx context.Context, values map[string]string) (store.Identity, error)
}

// Redirect is a driver that sends people to another site to sign in and
// back to a callback.
type Redirect interface {
	Provider
	Start(ctx context.Context, returnTo string) (authURL, state string, err error)
	Finish(ctx context.Context, cookieState string, q url.Values) (store.Identity, string, error)
}

// Problem is a reason sign-in failed that is safe to show the person trying.
type Problem string

func (p Problem) Error() string { return string(p) }

func New(cfg config.Config) ([]Provider, error) {
	var out []Provider
	for _, d := range cfg.Auth {
		switch d {
		case "name":
			out = append(out, Name{})
		case "ldap":
			l, err := NewLDAP(cfg.LDAP)
			if err != nil {
				return nil, err
			}
			out = append(out, l)
		case "oidc":
			out = append(out, NewOIDC(cfg.OIDC, cfg.PublicURL))
		default:
			return nil, fmt.Errorf("unknown sign-in driver %q", d)
		}
	}
	return out, nil
}
