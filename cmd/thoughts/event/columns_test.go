package event_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
)

// currentColumns re-reads the retro, so assertions see what was persisted.
func (h *harness) currentColumns(t *testing.T) model.RetroColumns {
	t.Helper()

	retro, err := dal.RetroGet(context.Background(), h.db, h.retro.ID)
	if err != nil {
		t.Fatalf("failed to re-read retro: %v", err)
	}

	return retro.GetColumns()
}

func TestColumnUpdateRenamesInPlace(t *testing.T) {
	h := newHarness(t)
	user := h.user(t, "Facilitator")

	target := h.columns[0].ID

	if err := h.handle(t, user, "column_update", map[string]any{
		"id":          target.String(),
		"title":       "What went well",
		"description": "Wins worth repeating",
	}); err != nil {
		t.Fatalf("column_update failed: %v", err)
	}

	if evt := h.next(t); evt.Name != "retro_updated" {
		t.Fatalf("expected retro_updated, got %s", evt.Name)
	}

	columns := h.currentColumns(t)

	if len(columns) != 2 {
		t.Fatalf("expected 2 columns, got %d", len(columns))
	}

	updated := columns.Find(target)
	if updated == nil {
		t.Fatal("the column lost its id")
	}

	if updated.Title != "What went well" || updated.Description != "Wins worth repeating" {
		t.Errorf("column was not updated: %+v", updated)
	}

	// The other column is untouched, and order is preserved.
	if columns[0].ID != target {
		t.Error("columns were reordered")
	}

	if columns[1].Title != "Went badly" {
		t.Errorf("the neighbouring column changed to %q", columns[1].Title)
	}
}

func TestColumnUpdateClearsADescription(t *testing.T) {
	h := newHarness(t)

	if err := h.handle(t, h.user(t, "Facilitator"), "column_update", map[string]any{
		"id":          h.columns[0].ID.String(),
		"title":       "Went well",
		"description": "",
	}); err != nil {
		t.Fatalf("column_update failed: %v", err)
	}

	h.next(t)

	if got := h.currentColumns(t)[0].Description; got != "" {
		t.Errorf("description = %q, want it cleared", got)
	}
}

func TestColumnUpdateRejectsBadInput(t *testing.T) {
	cases := map[string]map[string]any{
		"missing id":    {"title": "A title", "description": ""},
		"unknown id":    {"id": uuid.New().String(), "title": "A title", "description": ""},
		"not a uuid":    {"id": "tasks", "title": "A title", "description": ""},
		"empty title":   {"title": "", "description": ""},
		"short title":   {"title": "a", "description": ""},
		"missing title": {"description": ""},
	}

	for name, payload := range cases {
		t.Run(name, func(t *testing.T) {
			h := newHarness(t)

			if _, ok := payload["id"]; !ok {
				if name != "missing id" {
					payload["id"] = h.columns[0].ID.String()
				}
			}

			if err := h.handle(t, h.user(t, "Facilitator"), "column_update", payload); err == nil {
				t.Errorf("expected %v to be rejected", payload)
			}
		})
	}
}

func TestColumnDeleteRemovesAnEmptyColumn(t *testing.T) {
	h := newHarness(t)
	user := h.user(t, "Facilitator")

	if err := h.handle(t, user, "column_create", map[string]any{
		"title":       "Ideas",
		"description": "Anything else",
	}); err != nil {
		t.Fatalf("column_create failed: %v", err)
	}

	h.next(t)

	target := h.currentColumns(t)[2].ID

	if err := h.handle(t, user, "column_delete", map[string]any{"id": target.String()}); err != nil {
		t.Fatalf("column_delete failed: %v", err)
	}

	if evt := h.next(t); evt.Name != "retro_updated" {
		t.Fatalf("expected retro_updated, got %s", evt.Name)
	}

	columns := h.currentColumns(t)

	if len(columns) != 2 {
		t.Fatalf("expected 2 columns after delete, got %d", len(columns))
	}

	if columns.Find(target) != nil {
		t.Error("the deleted column is still there")
	}
}

func TestColumnDeleteRefusesWhenTheColumnHasNotes(t *testing.T) {
	h := newHarness(t)
	user := h.user(t, "Author")

	if err := h.handle(t, user, "column_create", map[string]any{
		"title":       "Ideas",
		"description": "",
	}); err != nil {
		t.Fatalf("column_create failed: %v", err)
	}

	h.next(t)

	h.createNote(t, user, "a thought worth keeping")

	assertErrorEvent(
		t,
		h.handle(t, user, "column_delete", map[string]any{"id": h.columns[0].ID.String()}),
		"cannot delete a column that contains notes",
	)

	if len(h.currentColumns(t)) != 3 {
		t.Error("the column was deleted despite holding a note")
	}
}

func TestColumnDeleteKeepsAMinimumOfTwo(t *testing.T) {
	h := newHarness(t)

	assertErrorEvent(
		t,
		h.handle(t, h.user(t, "Facilitator"), "column_delete", map[string]any{
			"id": h.columns[0].ID.String(),
		}),
		"a retro must have at least 2 columns",
	)

	if len(h.currentColumns(t)) != 2 {
		t.Error("a column was removed below the minimum")
	}
}

func TestColumnDeleteRejectsAnUnknownColumn(t *testing.T) {
	h := newHarness(t)

	assertErrorEvent(
		t,
		h.handle(t, h.user(t, "Facilitator"), "column_delete", map[string]any{
			"id": uuid.New().String(),
		}),
		"column not found",
	)
}

func TestColumnDeleteRejectsTheSyntheticTasksColumn(t *testing.T) {
	h := newHarness(t)

	// The discuss stage renders a hardcoded "tasks" column that must not be
	// able to reach a handler.
	if err := h.handle(t, h.user(t, "Facilitator"), "column_delete", map[string]any{
		"id": "tasks",
	}); err == nil {
		t.Error("expected a non-uuid column id to be rejected")
	}
}

func TestColumnCreateAppendsUpToTheLimit(t *testing.T) {
	h := newHarness(t)
	user := h.user(t, "Facilitator")

	for i := range 3 {
		if err := h.handle(t, user, "column_create", map[string]any{
			"title":       "Extra column",
			"description": "",
		}); err != nil {
			t.Fatalf("column_create %d failed: %v", i, err)
		}

		h.next(t)
	}

	if len(h.currentColumns(t)) != 5 {
		t.Fatalf("expected 5 columns, got %d", len(h.currentColumns(t)))
	}

	assertErrorEvent(
		t,
		h.handle(t, user, "column_create", map[string]any{"title": "One too many", "description": ""}),
		"a retro can have at most 5 columns",
	)
}

func TestColumnCreateAssignsAnID(t *testing.T) {
	h := newHarness(t)

	if err := h.handle(t, h.user(t, "Facilitator"), "column_create", map[string]any{
		"title":       "Ideas",
		"description": "Anything else",
	}); err != nil {
		t.Fatalf("column_create failed: %v", err)
	}

	h.next(t)

	added := h.currentColumns(t)[2]

	if added.ID == uuid.Nil {
		t.Error("the new column has no id")
	}

	if added.Title != "Ideas" || added.Description != "Anything else" {
		t.Errorf("the new column is wrong: %+v", added)
	}
}

func TestColumnsMayBeChangedInAnyStage(t *testing.T) {
	for _, status := range []model.RetroStatus{
		model.RetroStatusBrainstorm,
		model.RetroStatusGroup,
		model.RetroStatusVote,
		model.RetroStatusDiscuss,
	} {
		t.Run(string(status), func(t *testing.T) {
			h := newHarness(t)

			if err := dal.RetroUpdateStatus(context.Background(), h.db, h.retro.ID, status); err != nil {
				t.Fatalf("failed to set status: %v", err)
			}

			if err := h.handle(t, h.user(t, "Facilitator"), "column_update", map[string]any{
				"id":          h.columns[0].ID.String(),
				"title":       "Renamed mid retro",
				"description": "",
			}); err != nil {
				t.Fatalf("column_update failed in %s: %v", status, err)
			}

			h.next(t)

			if h.currentColumns(t)[0].Title != "Renamed mid retro" {
				t.Errorf("the rename did not stick in %s", status)
			}
		})
	}
}

func TestConcurrentColumnCreatesDoNotClobberEachOther(t *testing.T) {
	h := newHarness(t)
	user := h.user(t, "Facilitator")

	// Columns are one JSON blob, so simultaneous edits race on a
	// read-modify-write.
	var wg sync.WaitGroup

	for i := range 3 {
		wg.Add(1)

		go func() {
			defer wg.Done()

			body, err := json.Marshal(map[string]any{
				"name": "column_create",
				"payload": map[string]any{
					"title":       fmt.Sprintf("Column %d", i),
					"description": "",
				},
			})
			if err != nil {
				return
			}

			_ = h.broker.Handle(context.Background(), user, bytes.NewReader(body))
		}()
	}

	wg.Wait()

	for range 3 {
		h.next(t)
	}

	if got := len(h.currentColumns(t)); got != 5 {
		t.Errorf("expected 5 columns after 3 concurrent creates, got %d", got)
	}
}

func TestNotesCannotBeCreatedInADeletedColumn(t *testing.T) {
	h := newHarness(t)
	user := h.user(t, "Author")

	if err := h.handle(t, user, "column_create", map[string]any{
		"title":       "Doomed",
		"description": "",
	}); err != nil {
		t.Fatalf("column_create failed: %v", err)
	}

	h.next(t)

	doomed := h.currentColumns(t)[2].ID

	if err := h.handle(t, user, "column_delete", map[string]any{"id": doomed.String()}); err != nil {
		t.Fatalf("column_delete failed: %v", err)
	}

	h.next(t)

	assertErrorEvent(
		t,
		h.handle(t, user, "note_create", map[string]any{
			"column_id": doomed.String(),
			"content":   "a homeless thought",
		}),
		"that column no longer exists",
	)
}
