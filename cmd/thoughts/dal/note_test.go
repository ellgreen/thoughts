package dal_test

import (
	"context"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
	"github.com/google/uuid"
)

func TestNoteListReturnsNotesInCreationOrder(t *testing.T) {
	ctx := context.Background()
	db := testutil.NewDB(t)

	retro, err := dal.RetroInsert(ctx, db, "A test retro", model.RetroColumns{
		{Title: "Went well", Description: ""},
	}, false)
	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	user, err := dal.UserInsert(ctx, db, "Author")
	if err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	column := retro.GetColumns()[0]

	var created []uuid.UUID
	for _, content := range []string{"first", "second", "third"} {
		note, err := dal.NoteInsert(ctx, db, retro.ID, user.ID, column.ID, content)
		if err != nil {
			t.Fatalf("failed to insert note %q: %v", content, err)
		}

		created = append(created, note.ID)

		// NoteList orders by created_at; force distinct timestamps so the
		// test doesn't depend on the platform's clock resolution.
		time.Sleep(time.Millisecond)
	}

	notes, err := dal.NoteList(ctx, db, retro.ID)
	if err != nil {
		t.Fatalf("failed to list notes: %v", err)
	}

	if len(notes) != len(created) {
		t.Fatalf("expected %d notes, got %d", len(created), len(notes))
	}

	for i, note := range notes {
		if note.ID != created[i] {
			t.Errorf("position %d: expected note %s, got %s", i, created[i], note.ID)
		}
	}
}

func TestNoteListOrderSurvivesAnUpdate(t *testing.T) {
	ctx := context.Background()
	db := testutil.NewDB(t)

	retro, err := dal.RetroInsert(ctx, db, "A test retro", model.RetroColumns{
		{Title: "Went well", Description: ""},
	}, false)
	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	user, err := dal.UserInsert(ctx, db, "Author")
	if err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	column := retro.GetColumns()[0]

	var created []uuid.UUID
	for _, content := range []string{"a", "b", "c"} {
		note, err := dal.NoteInsert(ctx, db, retro.ID, user.ID, column.ID, content)
		if err != nil {
			t.Fatalf("failed to insert note %q: %v", content, err)
		}

		created = append(created, note.ID)
		time.Sleep(time.Millisecond)
	}

	// Update the first note, as grouping or moving it during the retro
	// would - this is what can shift a row's storage position in SQLite.
	if _, err := dal.NoteUpdate(ctx, db, created[0], uuid.Nil, uuid.New(), "a, regrouped", "", false); err != nil {
		t.Fatalf("failed to update note: %v", err)
	}

	notes, err := dal.NoteList(ctx, db, retro.ID)
	if err != nil {
		t.Fatalf("failed to list notes: %v", err)
	}

	for i, note := range notes {
		if note.ID != created[i] {
			t.Errorf("position %d: expected note %s, got %s - order changed after an update", i, created[i], note.ID)
		}
	}
}
