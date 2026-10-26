package v1import

import (
	"errors"
	"os"

	"github.com/gorilla/securecookie"
)

// V1Cookie is the name of v1's session cookie.
const V1Cookie = "session"

// v1 used gorilla/sessions' cookie store with only a hash key, so its
// cookies are signed gob, not encrypted, and last 30 days.
const v1CookieAge = 30 * 24 * 60 * 60

// Sessions recognises v1 session cookies, so people stay signed in as
// themselves across the upgrade.
type Sessions struct {
	codec *securecookie.SecureCookie
}

// LoadSessions reads v1's key, or returns nil when there is no key file,
// as on a fresh v2 install.
func LoadSessions(path string) (*Sessions, error) {
	key, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) || (err == nil && len(key) == 0) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	codec := securecookie.New(key, nil)
	codec.MaxAge(v1CookieAge)
	return &Sessions{codec: codec}, nil
}

// UserID returns the user a valid v1 cookie value was issued to.
func (s *Sessions) UserID(value string) (string, bool) {
	if s == nil {
		return "", false
	}
	values := map[any]any{}
	if err := s.codec.Decode(V1Cookie, value, &values); err != nil {
		return "", false
	}
	id, ok := values["user_id"].(string)
	return id, ok && id != ""
}
