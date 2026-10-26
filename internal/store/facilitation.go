package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

const maxTimer = 60 * 60

// earlier matches retros, in a table aliased as table, created before one
// given as (created_at, created_at, id). Times are kept to the second, so a
// tie goes to the id: newID makes those increase with every retro.
func earlier(table string) string {
	return fmt.Sprintf(`(%[1]s.created_at < ? OR (%[1]s.created_at = ? AND %[1]s.id < ?))`, table)
}

func (s *Store) updateTimer(ctx context.Context, retroID string, fn func(r Retro, now time.Time) (endsAt any, left any, err error)) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		now := s.now().UTC().Truncate(time.Second)
		endsAt, left, err := fn(r, now)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE retros SET timer_ends_at = ?, timer_left = ? WHERE id = ?`, endsAt, left, retroID)
		return err
	})
}

func checkSeconds(seconds int) error {
	if seconds < 10 || seconds > maxTimer {
		return Problem("A timer can run from 10 seconds to an hour.")
	}
	return nil
}

// StartTimer starts a fresh countdown, replacing any timer already going.
func (s *Store) StartTimer(ctx context.Context, retroID string, seconds int) error {
	if err := checkSeconds(seconds); err != nil {
		return err
	}
	return s.updateTimer(ctx, retroID, func(_ Retro, now time.Time) (any, any, error) {
		return stamp(now.Add(time.Duration(seconds) * time.Second)), nil, nil
	})
}

// AddTime lengthens a running or paused timer, or starts one.
func (s *Store) AddTime(ctx context.Context, retroID string, seconds int) error {
	if seconds < 1 || seconds > maxTimer {
		return Problem("Add up to an hour at a time.")
	}
	return s.updateTimer(ctx, retroID, func(r Retro, now time.Time) (any, any, error) {
		switch {
		case r.Timer.EndsAt != nil:
			base := *r.Timer.EndsAt
			if base.Before(now) {
				base = now
			}
			return stamp(base.Add(time.Duration(seconds) * time.Second)), nil, nil
		case r.Timer.Left > 0:
			return nil, min(r.Timer.Left+seconds, maxTimer), nil
		}
		return stamp(now.Add(time.Duration(seconds) * time.Second)), nil, nil
	})
}

func (s *Store) PauseTimer(ctx context.Context, retroID string) error {
	return s.updateTimer(ctx, retroID, func(r Retro, now time.Time) (any, any, error) {
		if r.Timer.EndsAt == nil {
			return nil, nullInt(r.Timer.Left), nil
		}
		left := int(r.Timer.EndsAt.Sub(now).Seconds())
		if left <= 0 {
			return nil, nil, nil
		}
		return nil, left, nil
	})
}

func (s *Store) ResumeTimer(ctx context.Context, retroID string) error {
	return s.updateTimer(ctx, retroID, func(r Retro, now time.Time) (any, any, error) {
		if r.Timer.Left <= 0 {
			return nullStamp(r.Timer.EndsAt), nil, nil
		}
		return stamp(now.Add(time.Duration(r.Timer.Left) * time.Second)), nil, nil
	})
}

func (s *Store) ClearTimer(ctx context.Context, retroID string) error {
	return s.updateTimer(ctx, retroID, func(Retro, time.Time) (any, any, error) { return nil, nil, nil })
}

func nullInt(n int) any {
	if n <= 0 {
		return nil
	}
	return n
}

func nullStamp(t *time.Time) any {
	if t == nil {
		return nil
	}
	return stamp(*t)
}

// SetReady marks someone done, or not, with the stage the retro is in now.
func (s *Store) SetReady(ctx context.Context, retroID, userID string, ready bool) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if ready {
			_, err = tx.ExecContext(ctx, `INSERT INTO ready (retro_id, user_id, stage) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`, retroID, userID, r.Stage)
		} else {
			_, err = tx.ExecContext(ctx, `DELETE FROM ready WHERE retro_id = ? AND user_id = ? AND stage = ?`, retroID, userID, r.Stage)
		}
		return err
	})
}

// Spotlight points everyone at one group while discussing; an empty
// groupID turns it off.
func (s *Store) Spotlight(ctx context.Context, retroID, groupID string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if r.Stage == Reflect {
			return Problem("There's nothing to look at together until grouping starts.")
		}
		if groupID != "" {
			var n int
			if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM groups WHERE id = ? AND retro_id = ?`, groupID, retroID).Scan(&n); err != nil {
				return err
			}
			if n == 0 {
				return ErrNotFound
			}
		}
		_, err = tx.ExecContext(ctx, `UPDATE retros SET spotlight_group_id = ? WHERE id = ?`, nullable(groupID), retroID)
		return err
	})
}

// earlierAction finds an open action from an earlier retro in the same team
// as retroID: the only kind "last time" can act on.
func earlierAction(ctx context.Context, tx *sql.Tx, retroID, actionID string) (Retro, Action, error) {
	r, err := retroIn(ctx, tx, retroID)
	if err != nil {
		return r, Action{}, err
	}
	if r.TeamID == "" {
		return r, Action{}, ErrNotFound
	}
	list, err := actionsIn(ctx, tx, `WHERE id = ? AND done_at IS NULL AND closed IS NULL
		AND retro_id IN (SELECT id FROM retros WHERE team_id = ? AND `+earlier("retros")+`)`, actionID, r.TeamID, stamp(r.CreatedAt), stamp(r.CreatedAt), retroID)
	if err != nil {
		return r, Action{}, err
	}
	if len(list) == 0 {
		return r, Action{}, ErrNotFound
	}
	return r, list[0], nil
}

// CloseEarlier settles an action from last time: "done", "dropped", or
// "carried", which also copies it into this retro.
func (s *Store) CloseEarlier(ctx context.Context, retroID, actionID, outcome string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		_, a, err := earlierAction(ctx, tx, retroID, actionID)
		if err != nil {
			return err
		}
		now := s.now()
		switch outcome {
		case "done":
			_, err = tx.ExecContext(ctx, `UPDATE actions SET done_at = ?, updated_at = ? WHERE id = ?`, stamp(now), stamp(now), a.ID)
		case "dropped":
			_, err = tx.ExecContext(ctx, `UPDATE actions SET closed = 'dropped', updated_at = ? WHERE id = ?`, stamp(now), a.ID)
		case "carried":
			if _, err = tx.ExecContext(ctx, `UPDATE actions SET closed = 'carried', updated_at = ? WHERE id = ?`, stamp(now), a.ID); err != nil {
				return err
			}
			_, err = tx.ExecContext(ctx, `INSERT INTO actions (id, retro_id, what, who, due_on, carried_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				newID(now), retroID, a.What, a.Who, nullable(a.DueOn), a.ID, stamp(now), stamp(now))
		default:
			err = errors.New("unknown outcome " + outcome)
		}
		return err
	})
}
