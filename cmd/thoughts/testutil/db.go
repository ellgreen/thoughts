// Package testutil provides throwaway databases for tests.
package testutil

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/ellgreen/thoughts/migrations"
	"github.com/jmoiron/sqlx"
	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"
)

// NewDB opens a throwaway SQLite database with every migration applied. It is
// removed with the test's temp directory.
func NewDB(t *testing.T) *sqlx.DB {
	t.Helper()

	db := open(t)

	if err := goose.Up(db.DB, "."); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return db
}

// NewDBAt opens a throwaway database migrated only as far as the given goose
// version, so a migration can be exercised against data that predates it.
func NewDBAt(t *testing.T, version int64) *sqlx.DB {
	t.Helper()

	db := open(t)

	if err := goose.UpTo(db.DB, ".", version); err != nil {
		t.Fatalf("failed to migrate test database to %d: %v", version, err)
	}

	return db
}

// MigrateUp applies any migrations still outstanding on db.
func MigrateUp(t *testing.T, db *sqlx.DB) {
	t.Helper()

	if err := goose.Up(db.DB, "."); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}
}

func open(t *testing.T) *sqlx.DB {
	t.Helper()

	goose.SetBaseFS(migrations.Embedded)
	goose.SetLogger(goose.NopLogger())

	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatalf("failed to set goose dialect: %v", err)
	}

	dsn := fmt.Sprintf("file:%s?_foreign_keys=on", filepath.Join(t.TempDir(), "test.sqlite"))

	db, err := sqlx.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	t.Cleanup(func() { db.Close() })

	return db
}
