package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"slices"
)

type Suggestion struct {
	ID      string
	Kind    string
	Payload json.RawMessage
}

// SaveSuggestion replaces any suggestion of the same kind in the retro.
func (s *Store) SaveSuggestion(ctx context.Context, retroID, kind string, payload json.RawMessage) error {
	now := s.now()
	_, err := s.db.ExecContext(ctx, `INSERT INTO ai_suggestions (id, retro_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (retro_id, kind) DO UPDATE SET id = excluded.id, payload = excluded.payload, created_at = excluded.created_at`,
		newID(now), retroID, kind, string(payload), stamp(now))
	return err
}

// TakeSuggestion removes a suggestion and returns it, for applying.
func (s *Store) TakeSuggestion(ctx context.Context, retroID, id string) (Suggestion, error) {
	var sg Suggestion
	var payload string
	err := s.db.QueryRowContext(ctx, `DELETE FROM ai_suggestions WHERE id = ? AND retro_id = ? RETURNING id, kind, payload`, id, retroID).
		Scan(&sg.ID, &sg.Kind, &payload)
	if errors.Is(err, sql.ErrNoRows) {
		return sg, ErrNotFound
	}
	sg.Payload = json.RawMessage(payload)
	return sg, err
}

// TakeSuggestionItem removes one item from a suggestion and returns a
// suggestion holding only that item. What's left gets a new id, so a second
// click on the same stale index finds nothing rather than taking a neighbour.
func (s *Store) TakeSuggestionItem(ctx context.Context, retroID, id string, item int) (Suggestion, error) {
	var sg Suggestion
	var payload string
	err := s.db.QueryRowContext(ctx, `SELECT id, kind, payload FROM ai_suggestions WHERE id = ? AND retro_id = ?`, id, retroID).
		Scan(&sg.ID, &sg.Kind, &payload)
	if errors.Is(err, sql.ErrNoRows) {
		return sg, ErrNotFound
	}
	if err != nil {
		return sg, err
	}
	var items []json.RawMessage
	if err := json.Unmarshal([]byte(payload), &items); err != nil {
		return sg, err
	}
	if item < 0 || item >= len(items) {
		return sg, ErrNotFound
	}
	sg.Payload, _ = json.Marshal(items[item : item+1])
	rest := slices.Delete(items, item, item+1)
	if len(rest) == 0 {
		_, err = s.db.ExecContext(ctx, `DELETE FROM ai_suggestions WHERE id = ?`, id)
		return sg, err
	}
	left, _ := json.Marshal(rest)
	_, err = s.db.ExecContext(ctx, `UPDATE ai_suggestions SET id = ?, payload = ? WHERE id = ?`, newID(s.now()), string(left), id)
	return sg, err
}

func (s *Store) SetRecap(ctx context.Context, retroID, recap string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE retros SET recap = ?, updated_at = ? WHERE id = ?`, recap, stamp(s.now()), retroID)
	if err != nil {
		return err
	}
	return mustAffect(res)
}

func suggestionsIn(ctx context.Context, q querier, retroID string) ([]Suggestion, error) {
	var out []Suggestion
	err := scanAll(ctx, q, &out, `SELECT id, kind, payload FROM ai_suggestions WHERE retro_id = ? ORDER BY created_at`, []any{retroID},
		func(r *sql.Rows, sg *Suggestion) error {
			var payload string
			if err := r.Scan(&sg.ID, &sg.Kind, &payload); err != nil {
				return err
			}
			sg.Payload = json.RawMessage(payload)
			return nil
		})
	return out, err
}
