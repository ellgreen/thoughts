package store

import (
	"context"
	"fmt"
)

// Check looks for anything that should never be true of a healthy database:
// SQLite-level damage, broken references, groups with no notes, and anyone
// holding more votes than the retro allows.
func (s *Store) Check(ctx context.Context) error {
	var integrity string
	if err := s.db.QueryRowContext(ctx, `PRAGMA integrity_check`).Scan(&integrity); err != nil {
		return err
	}
	if integrity != "ok" {
		return fmt.Errorf("integrity_check: %s", integrity)
	}
	rows, err := s.db.QueryContext(ctx, `PRAGMA foreign_key_check`)
	if err != nil {
		return err
	}
	broken := rows.Next()
	rows.Close()
	if broken {
		return fmt.Errorf("foreign_key_check found rows pointing at nothing")
	}
	checks := []struct{ what, query string }{
		{"groups with no notes", `SELECT COUNT(*) FROM groups g WHERE NOT EXISTS (SELECT 1 FROM notes n WHERE n.group_id = g.id)`},
		{"people over their vote limit", `SELECT COUNT(*) FROM (SELECT v.retro_id, v.user_id, SUM(v.count) AS used, r.max_votes FROM votes v
			JOIN retros r ON r.id = v.retro_id GROUP BY v.retro_id, v.user_id HAVING used > r.max_votes)`},
		{"notes in a group from another retro", `SELECT COUNT(*) FROM notes n JOIN groups g ON g.id = n.group_id WHERE g.retro_id != n.retro_id`},
		{"votes on a group from another retro", `SELECT COUNT(*) FROM votes v JOIN groups g ON g.id = v.group_id WHERE g.retro_id != v.retro_id`},
	}
	for _, c := range checks {
		var n int
		if err := s.db.QueryRowContext(ctx, c.query).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			return fmt.Errorf("%d %s", n, c.what)
		}
	}
	return nil
}
