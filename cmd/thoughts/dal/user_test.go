package dal_test

import (
	"context"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// The migration that collapses duplicate identities. Everything before it is
// applied first so the test can seed the mess it is meant to clean up.
const beforeDedupeVersion = 20250510163227

func TestUserGetOrCreateReusesTheSameIdentity(t *testing.T) {
	db := testutil.NewDB(t)
	ctx := context.Background()

	first, err := dal.UserGetOrCreate(ctx, db, "Ada Lovelace")
	if err != nil {
		t.Fatalf("first login failed: %v", err)
	}

	second, err := dal.UserGetOrCreate(ctx, db, "Ada Lovelace")
	if err != nil {
		t.Fatalf("second login failed: %v", err)
	}

	if first.ID != second.ID {
		t.Errorf("logging in again produced a new identity: %s then %s", first.ID, second.ID)
	}

	other, err := dal.UserGetOrCreate(ctx, db, "Grace Hopper")
	if err != nil {
		t.Fatalf("third login failed: %v", err)
	}

	if other.ID == first.ID {
		t.Error("different names collapsed onto the same identity")
	}
}

func TestDedupeMigrationCollapsesDuplicateUsers(t *testing.T) {
	db := testutil.NewDBAt(t, beforeDedupeVersion)
	ctx := context.Background()

	retroID := seedRetro(t, db)

	// The same person across three sessions, oldest first.
	oldest := seedUser(t, db, "Ada", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	middle := seedUser(t, db, "Ada", time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))
	newest := seedUser(t, db, "Ada", time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC))
	other := seedUser(t, db, "Grace", time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC))

	groupID := uuid.New()

	noteA := seedNote(t, db, retroID, middle, groupID)
	noteB := seedNote(t, db, retroID, newest, groupID)
	noteC := seedNote(t, db, retroID, other, uuid.New())

	// Two identities of the same person voting for the same group: the unique
	// index on (retro_id, user_id, group_id) only bites once they are merged.
	seedVote(t, db, retroID, middle, groupID)
	seedVote(t, db, retroID, newest, groupID)

	testutil.MigrateUp(t, db)

	var remaining int
	if err := db.GetContext(ctx, &remaining, "select count(*) from users where name = 'Ada'"); err != nil {
		t.Fatalf("failed to count users: %v", err)
	}

	if remaining != 1 {
		t.Errorf("expected 1 Ada after dedupe, got %d", remaining)
	}

	for _, noteID := range []uuid.UUID{noteA, noteB} {
		var userID uuid.UUID
		if err := db.GetContext(ctx, &userID, "select user_id from notes where id = ?", noteID); err != nil {
			t.Fatalf("failed to read note %s: %v", noteID, err)
		}

		if userID != oldest {
			t.Errorf("note %s points at %s, expected the earliest identity %s", noteID, userID, oldest)
		}
	}

	var untouched uuid.UUID
	if err := db.GetContext(ctx, &untouched, "select user_id from notes where id = ?", noteC); err != nil {
		t.Fatalf("failed to read note %s: %v", noteC, err)
	}

	if untouched != other {
		t.Errorf("an unrelated note moved from %s to %s", other, untouched)
	}

	var votes int
	if err := db.GetContext(ctx, &votes, "select count(*) from votes where retro_id = ?", retroID); err != nil {
		t.Fatalf("failed to count votes: %v", err)
	}

	if votes != 1 {
		t.Errorf("expected the colliding votes to collapse to 1, got %d", votes)
	}

	// The unique index should now be in force.
	_, err := db.ExecContext(ctx, `
		insert into users (id, name, created_at, updated_at) values (?, 'Ada', ?, ?)
	`, uuid.New(), time.Now(), time.Now())

	if err == nil {
		t.Error("expected a duplicate name to be rejected after the migration")
	}
}

func seedRetro(t *testing.T, db *sqlx.DB) uuid.UUID {
	t.Helper()

	id := uuid.New()

	_, err := db.Exec(`
		insert into retros (id, status, title, columns, created_at, updated_at)
		values (?, 'brainstorm', 'Seeded retro', '[]', ?, ?)
	`, id, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	return id
}

func seedUser(t *testing.T, db *sqlx.DB, name string, createdAt time.Time) uuid.UUID {
	t.Helper()

	id := uuid.New()

	_, err := db.Exec(`
		insert into users (id, name, created_at, updated_at) values (?, ?, ?, ?)
	`, id, name, createdAt, createdAt)

	if err != nil {
		t.Fatalf("failed to seed user %s: %v", name, err)
	}

	return id
}

func seedNote(t *testing.T, db *sqlx.DB, retroID, userID, groupID uuid.UUID) uuid.UUID {
	t.Helper()

	id := uuid.New()

	_, err := db.Exec(`
		insert into notes (id, retro_id, user_id, column_id, group_id, content, created_at, updated_at)
		values (?, ?, ?, ?, ?, 'seeded note', ?, ?)
	`, id, retroID, userID, uuid.New(), groupID, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("failed to seed note: %v", err)
	}

	return id
}

func seedVote(t *testing.T, db *sqlx.DB, retroID, userID, groupID uuid.UUID) {
	t.Helper()

	_, err := db.Exec(`
		insert into votes (id, retro_id, user_id, group_id, created_at, updated_at)
		values (?, ?, ?, ?, ?, ?)
	`, uuid.New(), retroID, userID, groupID, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("failed to seed vote: %v", err)
	}
}
