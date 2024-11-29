package session

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
)

const keyLength = 64

var ErrValueNotFound = errors.New("session: value not found")

type Provider struct {
	store sessions.Store
}

func LoadSessionProvider(keyPath string) (*Provider, error) {
	key, err := loadKey(keyPath)
	if err != nil {
		return nil, err
	}

	return &Provider{store: sessions.NewCookieStore(key)}, nil
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
	if err != nil {
		if sess == nil {
			return nil, fmt.Errorf("failed to get session: %w", err)
		}

		slog.Warn("failed to get session, creating a new one", "err", err)

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
