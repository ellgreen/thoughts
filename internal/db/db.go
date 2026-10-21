package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"

	_ "modernc.org/sqlite"
)

// Open uses modernc's _pragma syntax. v1 used mattn's _foreign_keys=on form,
// which modernc ignores, so its foreign keys were never enforced.
func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	dsn := "file:" + path + "?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)"
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// SQLite has one writer. One connection serialises writes in Go rather
	// than surfacing SQLITE_BUSY when two requests write at once.
	d.SetMaxOpenConns(1)
	if err := d.Ping(); err != nil {
		_ = d.Close()
		return nil, err
	}
	return d, nil
}

var ErrV1 = errors.New("this is a thoughts v1 database")

// IsV1 reports whether d was written by thoughts v1, which tracked its
// migrations with goose.
func IsV1(ctx context.Context, d *sql.DB) (bool, error) {
	var goose, ours bool
	err := d.QueryRowContext(ctx, `SELECT
		EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'goose_db_version'),
		EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations')`).Scan(&goose, &ours)
	return goose && !ours, err
}

// Migrate applies each *.sql file in fsys once, in name order, each in its
// own transaction.
func Migrate(ctx context.Context, d *sql.DB, fsys fs.FS) error {
	if v1, err := IsV1(ctx, d); err != nil {
		return err
	} else if v1 {
		return ErrV1
	}
	if _, err := d.ExecContext(ctx, createMigrations); err != nil {
		return err
	}
	pending, err := pendingIn(ctx, d, fsys)
	if err != nil {
		return err
	}
	for _, name := range pending {
		tx, err := d.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if err := apply(ctx, tx, fsys, name); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// MigrateTx applies every pending migration inside tx, for callers such as
// the v1 import that must create the schema and fill it in one go.
func MigrateTx(ctx context.Context, tx *sql.Tx, fsys fs.FS) error {
	if _, err := tx.ExecContext(ctx, createMigrations); err != nil {
		return err
	}
	pending, err := pendingIn(ctx, tx, fsys)
	if err != nil {
		return err
	}
	for _, name := range pending {
		if err := apply(ctx, tx, fsys, name); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}

const createMigrations = `CREATE TABLE IF NOT EXISTS schema_migrations (
	name TEXT PRIMARY KEY,
	applied_at TEXT NOT NULL
)`

type queryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func pendingIn(ctx context.Context, q queryer, fsys fs.FS) ([]string, error) {
	names, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return nil, err
	}
	slices.Sort(names)
	done, err := applied(ctx, q)
	if err != nil {
		return nil, err
	}
	return slices.DeleteFunc(names, func(n string) bool { return slices.Contains(done, n) }), nil
}

func apply(ctx context.Context, tx *sql.Tx, fsys fs.FS, name string) error {
	body, err := fs.ReadFile(fsys, name)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, string(body)); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO schema_migrations (name, applied_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`, name)
	return err
}

func Applied(ctx context.Context, d *sql.DB) ([]string, error) {
	return applied(ctx, d)
}

func applied(ctx context.Context, q queryer) ([]string, error) {
	rows, err := q.QueryContext(ctx, `SELECT name FROM schema_migrations ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		names = append(names, n)
	}
	return names, rows.Err()
}
