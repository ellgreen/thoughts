package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"time"
)

const SessionLifetime = 30 * 24 * time.Hour

type User struct {
	ID        string
	Name      string
	CreatedAt time.Time
}

// Identity is who a sign-in driver says someone is. An empty Subject means
// the driver cannot recognise people again, as with name sign-in, so every
// sign-in is a new user.
type Identity struct {
	Provider string
	Subject  string
	Name     string
}

// SignIn returns the user for id, creating one when the driver has not seen
// this subject before. A returning subject keeps their user and takes the
// name the driver gives now.
func (s *Store) SignIn(ctx context.Context, id Identity) (User, error) {
	now := s.now()
	var u User
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		if id.Subject != "" {
			err := tx.QueryRowContext(ctx, `SELECT user_id FROM identities WHERE provider = ? AND subject = ?`, id.Provider, id.Subject).Scan(&u.ID)
			if err == nil {
				_, err = tx.ExecContext(ctx, `UPDATE users SET name = ? WHERE id = ?`, id.Name, u.ID)
				u.Name = id.Name
				return err
			}
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}
		u = User{ID: newID(now), Name: id.Name, CreatedAt: now.UTC().Truncate(time.Second)}
		if _, err := tx.ExecContext(ctx, `INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)`, u.ID, u.Name, stamp(now)); err != nil {
			return err
		}
		if id.Subject == "" {
			return nil
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO identities (provider, subject, user_id, created_at) VALUES (?, ?, ?, ?)`,
			id.Provider, id.Subject, u.ID, stamp(now))
		return err
	})
	return u, err
}

// CreateSession returns the token for the cookie; only its hash is kept.
func (s *Store) CreateSession(ctx context.Context, userID string) (string, error) {
	token := rand.Text()
	now := s.now()
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
		hash(token), userID, stamp(now), stamp(now.Add(SessionLifetime)))
	return token, err
}

func (s *Store) UserBySession(ctx context.Context, token string) (User, error) {
	var u User
	var created string
	err := s.db.QueryRowContext(ctx, `SELECT u.id, u.name, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, hash(token), stamp(s.now())).Scan(&u.ID, &u.Name, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	u.CreatedAt, err = parseStamp(created)
	return u, err
}

func (s *Store) UserByID(ctx context.Context, id string) (User, error) {
	var u User
	var created string
	err := s.db.QueryRowContext(ctx, `SELECT id, name, created_at FROM users WHERE id = ?`, id).Scan(&u.ID, &u.Name, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	u.CreatedAt, err = parseStamp(created)
	return u, err
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, hash(token))
	return err
}
