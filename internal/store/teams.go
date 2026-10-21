package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

type Team struct {
	ID   string
	Slug string
	Name string
}

type TeamSummary struct {
	Team
	Retros      int
	OpenActions int
}

func teamIn(ctx context.Context, q querier, where string, args ...any) (Team, error) {
	var t Team
	err := q.QueryRowContext(ctx, `SELECT id, slug, name FROM teams `+where, args...).Scan(&t.ID, &t.Slug, &t.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}

func teamExists(ctx context.Context, q querier, id string) error {
	if id == "" {
		return nil
	}
	if _, err := teamIn(ctx, q, `WHERE id = ?`, id); errors.Is(err, ErrNotFound) {
		return Problem("That team doesn't exist any more.")
	} else if err != nil {
		return err
	}
	return nil
}

// CreateTeam makes a team. With fromTag, every retro carrying that tag and
// not already in a team joins it, which is how a v1 tag becomes a team.
func (s *Store) CreateTeam(ctx context.Context, name, fromTag string) (Team, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n < 2 || n > 60 {
		return Team{}, Problem("Give the team a name of 2 to 60 characters.")
	}
	base := CleanTag(name)
	base = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' {
			return r
		}
		return -1
	}, base)
	if base == "" {
		base = "team"
	}
	now := s.now()
	t := Team{ID: newID(now), Name: name}
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		for i := 1; ; i++ {
			t.Slug = base
			if i > 1 {
				t.Slug = fmt.Sprintf("%s-%d", base, i)
			}
			if _, err := teamIn(ctx, tx, `WHERE slug = ?`, t.Slug); errors.Is(err, ErrNotFound) {
				break
			} else if err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO teams (id, slug, name, created_at) VALUES (?, ?, ?, ?)`, t.ID, t.Slug, t.Name, stamp(now)); err != nil {
			return err
		}
		if fromTag == "" {
			return nil
		}
		_, err := tx.ExecContext(ctx, `UPDATE retros SET team_id = ? WHERE team_id IS NULL AND id IN (SELECT retro_id FROM retro_tags WHERE tag = ?)`,
			t.ID, CleanTag(fromTag))
		return err
	})
	return t, err
}

func (s *Store) TeamBySlug(ctx context.Context, slug string) (Team, error) {
	return teamIn(ctx, s.db, `WHERE slug = ?`, slug)
}

func (s *Store) Teams(ctx context.Context) ([]TeamSummary, error) {
	out := []TeamSummary{}
	err := scanAll(ctx, s.db, &out, `SELECT t.id, t.slug, t.name,
		(SELECT COUNT(*) FROM retros r WHERE r.team_id = t.id AND r.unlisted = 0),
		(SELECT COUNT(*) FROM actions a JOIN retros r ON r.id = a.retro_id WHERE r.team_id = t.id AND r.unlisted = 0 AND a.done_at IS NULL AND a.closed IS NULL)
		FROM teams t ORDER BY t.name COLLATE NOCASE`, nil,
		func(r *sql.Rows, t *TeamSummary) error {
			return r.Scan(&t.ID, &t.Slug, &t.Name, &t.Retros, &t.OpenActions)
		})
	return out, err
}

// TeamRetros is every listed retro in a team, newest first.
func (s *Store) TeamRetros(ctx context.Context, teamID string) ([]RetroSummary, error) {
	return s.listRetros(ctx, `r.team_id = ?`, []any{teamID}, 200)
}

func (s *Store) TeamOpenActions(ctx context.Context, teamID string) ([]OpenAction, error) {
	return s.openActions(ctx, `r.team_id = ? AND r.unlisted = 0`, teamID)
}

// openActions is actions not yet done, carried or dropped, from retros
// matching where, oldest retro's first.
func (s *Store) openActions(ctx context.Context, where string, args ...any) ([]OpenAction, error) {
	out := []OpenAction{}
	err := scanAll(ctx, s.db, &out, `SELECT a.id, a.what, a.who, COALESCE(a.due_on, ''), r.id, r.title FROM actions a
		JOIN retros r ON r.id = a.retro_id
		WHERE a.done_at IS NULL AND a.closed IS NULL AND `+where+`
		ORDER BY r.created_at, a.created_at`, args,
		func(r *sql.Rows, a *OpenAction) error {
			return r.Scan(&a.ID, &a.What, &a.Who, &a.DueOn, &a.RetroID, &a.RetroTitle)
		})
	return out, err
}
