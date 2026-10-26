package db

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"slices"
	"testing"
	"testing/fstest"

	"github.com/ellgreen/thoughts/migrations"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := Open(filepath.Join(t.TempDir(), "thoughts.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

func TestMigrateRunsEachFileOnceInNameOrder(t *testing.T) {
	d := testDB(t)
	fsys := fstest.MapFS{
		"0002_b.sql": {Data: []byte(`CREATE TABLE b (a_id INTEGER REFERENCES a (id));`)},
		"0001_a.sql": {Data: []byte(`CREATE TABLE a (id INTEGER PRIMARY KEY);`)},
	}
	ctx := context.Background()
	for range 2 {
		if err := Migrate(ctx, d, fsys); err != nil {
			t.Fatal(err)
		}
	}
	got, err := Applied(ctx, d)
	if err != nil || !slices.Equal(got, []string{"0001_a.sql", "0002_b.sql"}) {
		t.Fatalf("applied = %v, %v", got, err)
	}
}

func TestFailedMigrationLeavesNothingBehind(t *testing.T) {
	d := testDB(t)
	fsys := fstest.MapFS{"0001_bad.sql": {Data: []byte(`CREATE TABLE a (id INTEGER); CREATE TABLE a (id INTEGER);`)}}
	if err := Migrate(context.Background(), d, fsys); err == nil {
		t.Fatal("expected an error")
	}
	if got, _ := Applied(context.Background(), d); len(got) != 0 {
		t.Fatalf("applied = %v", got)
	}
	var n int
	_ = d.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE name = 'a'`).Scan(&n)
	if n != 0 {
		t.Fatal("table a survived the rollback")
	}
}

func TestPragmasTakeEffect(t *testing.T) {
	d := testDB(t)
	if err := Migrate(context.Background(), d, migrations.FS); err != nil {
		t.Fatal(err)
	}
	var fk int
	var mode string
	if err := d.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil || fk != 1 {
		t.Fatalf("foreign_keys = %d, %v", fk, err)
	}
	if err := d.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil || mode != "wal" {
		t.Fatalf("journal_mode = %q, %v", mode, err)
	}
	_, err := d.Exec(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('h', 'nobody', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')`)
	if err == nil {
		t.Fatal("a session for a missing user was accepted")
	}
}

func TestV1DatabaseIsRefused(t *testing.T) {
	d := testDB(t)
	if _, err := d.Exec(`CREATE TABLE goose_db_version (id INTEGER PRIMARY KEY, version_id INTEGER, is_applied INTEGER, tstamp TIMESTAMP);
		CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(context.Background(), d, migrations.FS); !errors.Is(err, ErrV1) {
		t.Fatalf("err = %v", err)
	}
	var n int
	_ = d.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE name = 'schema_migrations'`).Scan(&n)
	if n != 0 {
		t.Fatal("v2 started writing to a v1 database")
	}
}
