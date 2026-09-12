package event_test

import (
	"context"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
)

func (h *harness) advanceToDiscuss(t *testing.T) {
	t.Helper()

	if err := dal.RetroUpdateStatus(context.Background(), h.db, h.retro.ID, model.RetroStatusDiscuss); err != nil {
		t.Fatalf("failed to advance to discuss: %v", err)
	}
}

func TestReactionToggleAddsThenRemoves(t *testing.T) {
	h := newHarness(t)
	h.advanceToDiscuss(t)

	author := h.user(t, "Author")
	noteID := h.createNote(t, author, "a thought")

	if err := h.handle(t, author, "reaction_toggle", map[string]any{
		"note_id": noteID.String(),
		"emoji":   "👍",
		"value":   true,
	}); err != nil {
		t.Fatalf("reaction_toggle (add) failed: %v", err)
	}

	evt := h.next(t)
	if evt.Name != "note_reactions_updated" {
		t.Fatalf("expected note_reactions_updated, got %s", evt.Name)
	}

	if evt.Payload["id"] != noteID {
		t.Errorf("expected reactions for note %s, got %v", noteID, evt.Payload["id"])
	}

	if err := h.handle(t, author, "reaction_toggle", map[string]any{
		"note_id": noteID.String(),
		"emoji":   "👍",
		"value":   false,
	}); err != nil {
		t.Fatalf("reaction_toggle (remove) failed: %v", err)
	}

	if evt := h.next(t); evt.Name != "note_reactions_updated" {
		t.Errorf("expected note_reactions_updated, got %s", evt.Name)
	}

	reactions, err := dal.ReactionsForNote(context.Background(), h.db, noteID)
	if err != nil {
		t.Fatalf("failed to re-read reactions: %v", err)
	}

	if len(reactions) != 0 {
		t.Errorf("expected no reactions left, got %d", len(reactions))
	}
}

func TestReactionAddIsIdempotent(t *testing.T) {
	h := newHarness(t)
	h.advanceToDiscuss(t)

	author := h.user(t, "Author")
	noteID := h.createNote(t, author, "a thought")

	for range 2 {
		if err := h.handle(t, author, "reaction_toggle", map[string]any{
			"note_id": noteID.String(),
			"emoji":   "👍",
			"value":   true,
		}); err != nil {
			t.Fatalf("reaction_toggle (add) failed: %v", err)
		}

		h.next(t)
	}

	reactions, err := dal.ReactionsForNote(context.Background(), h.db, noteID)
	if err != nil {
		t.Fatalf("failed to re-read reactions: %v", err)
	}

	if len(reactions) != 1 {
		t.Errorf("expected exactly one reaction row, got %d", len(reactions))
	}
}

func TestReactionCountsAcrossUsers(t *testing.T) {
	h := newHarness(t)
	h.advanceToDiscuss(t)

	author := h.user(t, "Author")
	other := h.user(t, "Someone Else")
	noteID := h.createNote(t, author, "a thought")

	for _, user := range []*model.User{author, other} {
		if err := h.handle(t, user, "reaction_toggle", map[string]any{
			"note_id": noteID.String(),
			"emoji":   "🎉",
			"value":   true,
		}); err != nil {
			t.Fatalf("reaction_toggle failed for %s: %v", user.Name, err)
		}

		h.next(t)
	}

	reactions, err := dal.ReactionsForNote(context.Background(), h.db, noteID)
	if err != nil {
		t.Fatalf("failed to re-read reactions: %v", err)
	}

	if len(reactions) != 2 {
		t.Errorf("expected two reaction rows, got %d", len(reactions))
	}
}

func TestReactionRejectedOutsideDiscuss(t *testing.T) {
	h := newHarness(t)

	author := h.user(t, "Author")
	noteID := h.createNote(t, author, "a thought")

	assertErrorEvent(
		t,
		h.handle(t, author, "reaction_toggle", map[string]any{
			"note_id": noteID.String(),
			"emoji":   "👍",
			"value":   true,
		}),
		"reactions are only available while discussing",
	)
}

func TestReactionRejectsUnknownEmoji(t *testing.T) {
	h := newHarness(t)
	h.advanceToDiscuss(t)

	author := h.user(t, "Author")
	noteID := h.createNote(t, author, "a thought")

	assertErrorEvent(
		t,
		h.handle(t, author, "reaction_toggle", map[string]any{
			"note_id": noteID.String(),
			"emoji":   "💩",
			"value":   true,
		}),
		"that's not a reaction we support",
	)
}

func TestReactionOnNoteFromAnotherRetroIsRejected(t *testing.T) {
	h := newHarness(t)
	h.advanceToDiscuss(t)
	ctx := context.Background()

	author := h.user(t, "Author")

	otherRetro, err := dal.RetroInsert(ctx, h.db, "Another retro", model.RetroColumns{
		{Title: "One", Description: ""},
	}, false)
	if err != nil {
		t.Fatalf("failed to seed the second retro: %v", err)
	}

	foreign, err := dal.NoteInsert(ctx, h.db, otherRetro.ID, author.ID, otherRetro.GetColumns()[0].ID, "elsewhere")
	if err != nil {
		t.Fatalf("failed to seed the foreign note: %v", err)
	}

	assertErrorEvent(
		t,
		h.handle(t, author, "reaction_toggle", map[string]any{
			"note_id": foreign.ID.String(),
			"emoji":   "👍",
			"value":   true,
		}),
		"note not found",
	)
}
