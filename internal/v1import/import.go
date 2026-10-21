// Package v1import turns a thoughts v1 database into a v2 one, in place and
// in one transaction, after taking a copy of the file.
package v1import

import (
	"cmp"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/ellgreen/thoughts/internal/db"
)

type Summary struct {
	Backup    string
	Users     int
	Retros    int
	Notes     int
	Votes     int
	Reactions int
	Actions   int
	Tags      int
	// Dropped counts rows v1 had kept after what they pointed at was gone,
	// such as votes on a group whose notes were all deleted.
	Dropped map[string]int
}

func (s Summary) String() string {
	var dropped []string
	for _, k := range slices.Sorted(maps.Keys(s.Dropped)) {
		dropped = append(dropped, fmt.Sprintf("%d %s", s.Dropped[k], k))
	}
	out := fmt.Sprintf("%d users, %d retros, %d notes, %d votes, %d reactions, %d actions, %d tags", s.Users, s.Retros, s.Notes, s.Votes, s.Reactions, s.Actions, s.Tags)
	if len(dropped) > 0 {
		out += "; left out " + strings.Join(dropped, ", ")
	}
	return out
}

// Backup copies the database next to itself before anything changes it.
// VACUUM INTO writes a clean, consistent copy even with a WAL in use.
func Backup(ctx context.Context, d *sql.DB, dbPath string, now time.Time) (string, error) {
	name := fmt.Sprintf("%s.v1-backup-%s.sqlite", strings.TrimSuffix(filepath.Base(dbPath), filepath.Ext(dbPath)), now.UTC().Format("20060102-150405"))
	path := filepath.Join(filepath.Dir(dbPath), name)
	if _, err := os.Stat(path); err == nil {
		return "", fmt.Errorf("backup %s already exists", path)
	}
	if _, err := d.ExecContext(ctx, `VACUUM INTO ?`, path); err != nil {
		return "", fmt.Errorf("backing up the v1 database: %w", err)
	}
	return path, nil
}

var v1Tables = []string{"reactions", "votes", "tasks", "retro_tags", "notes", "retros", "users"}

// Import converts d, which must be a v1 database, to the v2 schema in
// migrations. Nothing changes unless every step succeeds.
func Import(ctx context.Context, d *sql.DB, migrations fs.FS) (Summary, error) {
	sum := Summary{Dropped: map[string]int{}}
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return sum, err
	}
	defer func() { _ = tx.Rollback() }()

	present := map[string]bool{}
	for _, t := range v1Tables {
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, t).Scan(&n); err != nil {
			return sum, err
		}
		if present[t] = n > 0; present[t] {
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`ALTER TABLE %q RENAME TO %q`, t, "v1_"+t)); err != nil {
				return sum, err
			}
		}
	}
	for _, t := range []string{"retros", "notes", "users", "votes", "tasks"} {
		if !present[t] {
			return sum, fmt.Errorf("this looks like a v1 database but has no %s table", t)
		}
	}
	// v1's indexes keep their names when their tables are renamed, and v2
	// reuses some of those names.
	if err := dropV1Indexes(ctx, tx); err != nil {
		return sum, err
	}
	if err := db.MigrateTx(ctx, tx, migrations); err != nil {
		return sum, err
	}

	c := &converter{tx: tx, ctx: ctx, sum: &sum, columns: map[string]bool{}}
	steps := []func() error{c.importUsers, c.importRetros, c.importNotes, c.importVotes, c.importActions}
	if present["retro_tags"] {
		steps = append(steps, c.importTags)
	}
	if present["reactions"] {
		steps = append(steps, c.importReactions)
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return sum, err
		}
	}

	for _, t := range v1Tables {
		if present[t] {
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`DROP TABLE %q`, "v1_"+t)); err != nil {
				return sum, err
			}
		}
	}
	if _, err := tx.ExecContext(ctx, `DROP TABLE goose_db_version`); err != nil {
		return sum, err
	}
	if err := checkForeignKeys(ctx, tx); err != nil {
		return sum, err
	}
	return sum, tx.Commit()
}

func dropV1Indexes(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'v1\_%' ESCAPE '\' AND sql IS NOT NULL`)
	if err != nil {
		return err
	}
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			return err
		}
		names = append(names, n)
	}
	rows.Close()
	for _, n := range names {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`DROP INDEX %q`, n)); err != nil {
			return err
		}
	}
	return nil
}

func checkForeignKeys(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `PRAGMA foreign_key_check`)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		var table, parent string
		var rowid, fkid sql.NullInt64
		_ = rows.Scan(&table, &rowid, &parent, &fkid)
		return fmt.Errorf("imported %s row %d points at a missing %s", table, rowid.Int64, parent)
	}
	return rows.Err()
}

type converter struct {
	ctx context.Context
	tx  *sql.Tx
	sum *Summary

	users   map[string]bool
	retros  map[string]bool
	columns map[string]bool
	// firstColumn is where a note goes if its own column has gone.
	firstColumn map[string]string
	// groups maps a v1 group, by retro and group id, to the v2 group.
	groups map[[2]string]string
	notes  map[string]bool
	ghost  string
}

func (c *converter) hasColumn(table, column string) (bool, error) {
	var n int
	err := c.tx.QueryRowContext(c.ctx, `SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`, "v1_"+table, column).Scan(&n)
	return n > 0, err
}

// optional selects a column that later v1 releases added, or a fallback for
// databases from before it existed.
func (c *converter) optional(table, column, fallback string) (string, error) {
	ok, err := c.hasColumn(table, column)
	if err != nil || !ok {
		return fallback, err
	}
	return fmt.Sprintf("%q", column), nil
}

func (c *converter) each(query string, scan func(*sql.Rows) error) error {
	rows, err := c.tx.QueryContext(c.ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		if err := scan(rows); err != nil {
			return err
		}
	}
	return rows.Err()
}

func (c *converter) exec(query string, args ...any) error {
	_, err := c.tx.ExecContext(c.ctx, query, args...)
	return err
}

func stamp(raw string) (string, error) {
	t, err := parseTime(raw)
	if err != nil {
		return "", err
	}
	return t.Format(time.RFC3339), nil
}

// collect reads every row before anything is written: the transaction is
// one connection, and it can't run an INSERT while these rows are open.
func collect[T any](c *converter, query string, scan func(*sql.Rows, *T) error) ([]T, error) {
	var out []T
	err := c.each(query, func(r *sql.Rows) error {
		var v T
		if err := scan(r, &v); err != nil {
			return err
		}
		out = append(out, v)
		return nil
	})
	return out, err
}

func (c *converter) importUsers() error {
	type row struct{ id, name, created string }
	list, err := collect(c, `SELECT id, name, created_at FROM v1_users`, func(r *sql.Rows, v *row) error {
		return r.Scan(&v.id, &v.name, &v.created)
	})
	if err != nil {
		return err
	}
	c.users = map[string]bool{}
	for _, u := range list {
		created, err := stamp(u.created)
		if err != nil {
			return err
		}
		if err := c.exec(`INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)`, u.id, u.name, created); err != nil {
			return err
		}
		c.users[u.id] = true
	}
	c.sum.Users = len(list)
	return nil
}

// author returns id, or a stand-in user when v1 kept notes from a user row
// that no longer exists.
func (c *converter) author(id string) (string, error) {
	if c.users[id] {
		return id, nil
	}
	if c.ghost == "" {
		c.ghost = "00000000-0000-7000-8000-000000000000"
		if err := c.exec(`INSERT INTO users (id, name, created_at) VALUES (?, 'Someone', ?)`, c.ghost, time.Unix(0, 0).UTC().Format(time.RFC3339)); err != nil {
			return "", err
		}
	}
	c.sum.Dropped["note authors (shown as Someone)"]++
	return c.ghost, nil
}

var stageFor = map[string]string{"brainstorm": "reflect", "group": "group", "vote": "vote", "discuss": "discuss"}

func (c *converter) importRetros() error {
	maxVotes, err := c.optional("retros", "max_votes", "5")
	if err != nil {
		return err
	}
	unlisted, err := c.optional("retros", "unlisted", "0")
	if err != nil {
		return err
	}
	type row struct {
		id, title, status, columns, created, updated string
		maxVotes                                     int
		unlisted                                     bool
	}
	list, err := collect(c, fmt.Sprintf(`SELECT id, title, status, columns, created_at, updated_at, COALESCE(%s, 5), COALESCE(%s, 0) FROM v1_retros`, maxVotes, unlisted),
		func(r *sql.Rows, v *row) error {
			return r.Scan(&v.id, &v.title, &v.status, &v.columns, &v.created, &v.updated, &v.maxVotes, &v.unlisted)
		})
	if err != nil {
		return err
	}
	c.retros = map[string]bool{}
	c.firstColumn = map[string]string{}
	for _, r := range list {
		stage, ok := stageFor[r.status]
		if !ok {
			return fmt.Errorf("retro %s has an unknown status %q", r.id, r.status)
		}
		created, err := stamp(r.created)
		if err != nil {
			return err
		}
		updated, err := stamp(r.updated)
		if err != nil {
			return err
		}
		var cols []struct {
			ID          string `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
		}
		if err := json.Unmarshal([]byte(r.columns), &cols); err != nil {
			return fmt.Errorf("retro %s columns: %w", r.id, err)
		}
		if err := c.exec(`INSERT INTO retros (id, title, stage, max_votes, unlisted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			r.id, r.title, stage, min(max(r.maxVotes, 1), 15), r.unlisted, created, updated); err != nil {
			return err
		}
		for i, col := range cols {
			if c.columns[col.ID] {
				return fmt.Errorf("column %s appears in more than one retro", col.ID)
			}
			if err := c.exec(`INSERT INTO columns (id, retro_id, position, title, description) VALUES (?, ?, ?, ?, ?)`, col.ID, r.id, i, col.Title, col.Description); err != nil {
				return err
			}
			c.columns[col.ID] = true
			if i == 0 {
				c.firstColumn[r.id] = col.ID
			}
		}
		c.retros[r.id] = true
	}
	c.sum.Retros = len(list)
	return nil
}

func (c *converter) importNotes() error {
	img, err := c.optional("notes", "img_url", "''")
	if err != nil {
		return err
	}
	type row struct{ id, retro, user, column, group, content, img, created, updated string }
	list, err := collect(c, fmt.Sprintf(`SELECT id, retro_id, user_id, column_id, group_id, content, COALESCE(%s, ''), created_at, updated_at FROM v1_notes ORDER BY created_at, id`, img),
		func(r *sql.Rows, v *row) error {
			return r.Scan(&v.id, &v.retro, &v.user, &v.column, &v.group, &v.content, &v.img, &v.created, &v.updated)
		})
	if err != nil {
		return err
	}
	c.groups = map[[2]string]string{}
	c.notes = map[string]bool{}
	used := map[string]bool{}
	for _, n := range list {
		if !c.retros[n.retro] {
			c.sum.Dropped["notes from deleted retros"]++
			continue
		}
		column := n.column
		if !c.columns[column] {
			column = c.firstColumn[n.retro]
			c.sum.Dropped["notes moved out of deleted columns"]++
		}
		created, err := stamp(n.created)
		if err != nil {
			return err
		}
		updated, err := stamp(n.updated)
		if err != nil {
			return err
		}
		key := [2]string{n.retro, n.group}
		group, ok := c.groups[key]
		if !ok {
			// A v1 group id names the group in v2 too, so votes on it still
			// land, unless that id is already taken elsewhere.
			group = n.group
			if used[group] {
				group = n.id
			}
			if err := c.exec(`INSERT INTO groups (id, retro_id, column_id, created_at) VALUES (?, ?, ?, ?)`, group, n.retro, column, created); err != nil {
				return err
			}
			used[group] = true
			c.groups[key] = group
		}
		author, err := c.author(n.user)
		if err != nil {
			return err
		}
		if err := c.exec(`INSERT INTO notes (id, retro_id, group_id, author_id, content, img_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			n.id, n.retro, group, author, n.content, n.img, created, updated); err != nil {
			return err
		}
		c.notes[n.id] = true
	}
	c.sum.Notes = len(c.notes)
	return nil
}

func (c *converter) importVotes() error {
	type row struct{ retro, user, group string }
	list, err := collect(c, `SELECT retro_id, user_id, group_id FROM v1_votes`, func(r *sql.Rows, v *row) error {
		return r.Scan(&v.retro, &v.user, &v.group)
	})
	if err != nil {
		return err
	}
	counts := map[[3]string]int{}
	for _, v := range list {
		group, ok := c.groups[[2]string{v.retro, v.group}]
		if !ok || !c.users[v.user] {
			c.sum.Dropped["votes on deleted groups or from deleted users"]++
			continue
		}
		counts[[3]string{v.retro, v.user, group}]++
	}
	keys := slices.SortedFunc(maps.Keys(counts), func(a, b [3]string) int { return cmp.Compare(a[0]+a[1]+a[2], b[0]+b[1]+b[2]) })
	for _, k := range keys {
		if err := c.exec(`INSERT INTO votes (retro_id, user_id, group_id, count) VALUES (?, ?, ?, ?)`, k[0], k[1], k[2], counts[k]); err != nil {
			return err
		}
		c.sum.Votes += counts[k]
	}
	return nil
}

func (c *converter) importActions() error {
	completed, err := c.optional("tasks", "completed", "0")
	if err != nil {
		return err
	}
	type row struct {
		id, retro, who, what, when, created, updated string
		done                                         bool
	}
	list, err := collect(c, fmt.Sprintf(`SELECT id, retro_id, who, what, "when", created_at, updated_at, COALESCE(%s, 0) FROM v1_tasks ORDER BY created_at, id`, completed),
		func(r *sql.Rows, v *row) error {
			return r.Scan(&v.id, &v.retro, &v.who, &v.what, &v.when, &v.created, &v.updated, &v.done)
		})
	if err != nil {
		return err
	}
	for _, a := range list {
		if !c.retros[a.retro] {
			c.sum.Dropped["actions from deleted retros"]++
			continue
		}
		created, err := stamp(a.created)
		if err != nil {
			return err
		}
		updated, err := stamp(a.updated)
		if err != nil {
			return err
		}
		var due any
		if t, err := parseTime(a.when); err == nil {
			due = t.Format(time.DateOnly)
		}
		var doneAt any
		if a.done {
			doneAt = updated
		}
		if err := c.exec(`INSERT INTO actions (id, retro_id, what, who, due_on, done_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			a.id, a.retro, a.what, a.who, due, doneAt, created, updated); err != nil {
			return err
		}
		c.sum.Actions++
	}
	return nil
}

func (c *converter) importTags() error {
	type row struct{ retro, tag string }
	list, err := collect(c, `SELECT retro_id, tag FROM v1_retro_tags`, func(r *sql.Rows, v *row) error { return r.Scan(&v.retro, &v.tag) })
	if err != nil {
		return err
	}
	for _, t := range list {
		if !c.retros[t.retro] {
			continue
		}
		if err := c.exec(`INSERT OR IGNORE INTO retro_tags (retro_id, tag) VALUES (?, ?)`, t.retro, t.tag); err != nil {
			return err
		}
		c.sum.Tags++
	}
	return nil
}

func (c *converter) importReactions() error {
	type row struct{ note, user, emoji, created string }
	list, err := collect(c, `SELECT note_id, user_id, emoji, created_at FROM v1_reactions`, func(r *sql.Rows, v *row) error {
		return r.Scan(&v.note, &v.user, &v.emoji, &v.created)
	})
	if err != nil {
		return err
	}
	for _, x := range list {
		if !c.notes[x.note] || !c.users[x.user] {
			c.sum.Dropped["reactions on deleted notes or from deleted users"]++
			continue
		}
		created, err := stamp(x.created)
		if err != nil {
			return err
		}
		if err := c.exec(`INSERT OR IGNORE INTO reactions (note_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)`, x.note, x.user, x.emoji, created); err != nil {
			return err
		}
		c.sum.Reactions++
	}
	return nil
}
