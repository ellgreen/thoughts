package exporters_test

import (
	"context"
	"strings"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/exporters"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func TestToMarkdown(t *testing.T) {
	db := testutil.NewDB(t)
	ctx := context.Background()

	retro, err := dal.RetroInsert(ctx, db, "Sprint 42 retro", model.RetroColumns{
		{Title: "Went well", Description: "The good bits"},
		{Title: "Went badly", Description: "The bad bits"},
	}, false)
	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	columns := retro.GetColumns()

	author, err := dal.UserInsert(ctx, db, "Ada")
	if err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	if _, err := dal.NoteInsert(ctx, db, retro.ID, author.ID, columns[0].ID, "deploys were quick"); err != nil {
		t.Fatalf("failed to seed note: %v", err)
	}

	withGif, err := dal.NoteInsert(ctx, db, retro.ID, author.ID, columns[1].ID, "too many meetings")
	if err != nil {
		t.Fatalf("failed to seed note: %v", err)
	}

	if _, err := dal.NoteUpdate(
		ctx, db, withGif.ID, withGif.ColumnID, withGif.GroupID, "", "https://example.com/tired.gif", false,
	); err != nil {
		t.Fatalf("failed to attach gif: %v", err)
	}

	seedTask(t, db, retro.ID, "Ada", "book a smaller room", true)
	seedTask(t, db, retro.ID, "Grace", "trim the standup", false)

	out, err := exporters.NewExporter(db).ToMarkdown(ctx, retro)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	got := string(out)

	for _, want := range []string{
		"# Sprint 42 retro",
		"## Went well",
		"The good bits",
		"> deploys were quick",
		"> &mdash; <cite>Ada</cite>",
		"## Went badly",
		"> too many meetings",
		"> ![](https://example.com/tired.gif)",
		"- [x] Ada: book a smaller room",
		"- [ ] Grace: trim the standup",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("export is missing %q\n---\n%s", want, got)
		}
	}
}

func TestToMarkdownWithNoContent(t *testing.T) {
	db := testutil.NewDB(t)
	ctx := context.Background()

	retro, err := dal.RetroInsert(ctx, db, "Empty retro", model.RetroColumns{
		{Title: "Only column", Description: ""},
		{Title: "Second column", Description: ""},
	}, false)
	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	out, err := exporters.NewExporter(db).ToMarkdown(ctx, retro)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	got := string(out)

	for _, want := range []string{"# Empty retro", "## Tasks", "## Notes", "## Only column"} {
		if !strings.Contains(got, want) {
			t.Errorf("export is missing %q\n---\n%s", want, got)
		}
	}
}

func seedTask(t *testing.T, db *sqlx.DB, retroID uuid.UUID, who, what string, completed bool) {
	t.Helper()

	ctx := context.Background()

	task, err := dal.TaskInsert(ctx, db, retroID, who, what, "2026-09-01")
	if err != nil {
		t.Fatalf("failed to seed task: %v", err)
	}

	if !completed {
		return
	}

	if _, err := dal.TaskUpdateComplete(ctx, db, task.ID, true); err != nil {
		t.Fatalf("failed to complete task: %v", err)
	}
}
