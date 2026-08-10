package event_test

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/event"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// harness drives a broker the way the socket does - inbound JSON in, broadcast
// events out - while draining both outbound channels so handlers never block.
type harness struct {
	db       *sqlx.DB
	broker   *event.Broker
	retro    *model.Retro
	columns  model.RetroColumns
	observed chan *event.Event
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	db := testutil.NewDB(t)

	columns := model.RetroColumns{
		{Title: "Went well", Description: "The good bits"},
		{Title: "Went badly", Description: "The bad bits"},
	}

	retro, err := dal.RetroInsert(context.Background(), db, "A test retro", columns, false)
	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	h := &harness{
		db:       db,
		broker:   event.NewBroker(db, retro.ID),
		retro:    retro,
		columns:  retro.GetColumns(),
		observed: make(chan *event.Event, 64),
	}

	observer := &model.User{ID: uuid.New(), Name: "Observer"}
	stop := make(chan struct{})
	t.Cleanup(func() { close(stop) })

	go func() {
		for {
			select {
			case <-stop:
				return
			case evt := <-h.broker.Listen():
				h.observed <- evt
			case userDependent := <-h.broker.ListenUserDependent():
				h.observed <- userDependent(observer)
			}
		}
	}()

	return h
}

func (h *harness) user(t *testing.T, name string) *model.User {
	t.Helper()

	user, err := dal.UserGetOrCreate(context.Background(), h.db, name)
	if err != nil {
		t.Fatalf("failed to create user %s: %v", name, err)
	}

	return user
}

func (h *harness) handle(t *testing.T, user *model.User, name string, payload map[string]any) error {
	t.Helper()

	body, err := json.Marshal(map[string]any{"name": name, "payload": payload})
	if err != nil {
		t.Fatalf("failed to encode event: %v", err)
	}

	return h.broker.Handle(context.Background(), user, bytes.NewReader(body))
}

// next waits for the next broadcast event, failing if none arrives.
func (h *harness) next(t *testing.T) *event.Event {
	t.Helper()

	select {
	case evt := <-h.observed:
		return evt
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for a broadcast event")
		return nil
	}
}

// createNote runs a note_create as user and returns the persisted note id.
func (h *harness) createNote(t *testing.T, user *model.User, content string) uuid.UUID {
	t.Helper()

	if err := h.handle(t, user, "note_create", map[string]any{
		"column_id": h.columns[0].ID.String(),
		"content":   content,
	}); err != nil {
		t.Fatalf("note_create failed: %v", err)
	}

	evt := h.next(t)
	if evt.Name != "note_created" {
		t.Fatalf("expected note_created, got %s", evt.Name)
	}

	// Payloads hold native values until they are marshalled onto the wire.
	id, ok := evt.Payload["id"].(uuid.UUID)
	if !ok {
		t.Fatalf("note_created carried an id of type %T", evt.Payload["id"])
	}

	return id
}

func assertErrorEvent(t *testing.T, err error, want string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected an error event saying %q, got nil", want)
	}

	if err.Error() != want {
		t.Errorf("expected error %q, got %q", want, err.Error())
	}
}

func TestStatusTransitions(t *testing.T) {
	cases := []struct {
		from    model.RetroStatus
		to      string
		wantErr string
	}{
		{model.RetroStatusBrainstorm, "group", ""},
		{model.RetroStatusBrainstorm, "vote", "invalid status transition"},
		{model.RetroStatusBrainstorm, "discuss", "invalid status transition"},
		{model.RetroStatusBrainstorm, "brainstorm", "status is already set to brainstorm"},
		{model.RetroStatusGroup, "brainstorm", ""},
		{model.RetroStatusGroup, "vote", ""},
		{model.RetroStatusGroup, "discuss", "invalid status transition"},
		{model.RetroStatusVote, "group", ""},
		{model.RetroStatusVote, "discuss", ""},
		{model.RetroStatusVote, "brainstorm", "invalid status transition"},
		{model.RetroStatusDiscuss, "vote", ""},
		{model.RetroStatusDiscuss, "group", "invalid status transition"},
		{model.RetroStatusDiscuss, "brainstorm", "invalid status transition"},
	}

	for _, tc := range cases {
		t.Run(string(tc.from)+"_to_"+tc.to, func(t *testing.T) {
			h := newHarness(t)
			user := h.user(t, "Facilitator")

			if err := dal.RetroUpdateStatus(context.Background(), h.db, h.retro.ID, tc.from); err != nil {
				t.Fatalf("failed to set starting status: %v", err)
			}

			err := h.handle(t, user, "status_update", map[string]any{"status": tc.to})

			if tc.wantErr != "" {
				assertErrorEvent(t, err, tc.wantErr)
				return
			}

			if err != nil {
				t.Fatalf("expected the transition to be allowed, got %v", err)
			}

			if evt := h.next(t); evt.Name != "status_updated" {
				t.Errorf("expected status_updated, got %s", evt.Name)
			}
		})
	}
}

func TestStatusUpdateRejectsUnknownStatus(t *testing.T) {
	h := newHarness(t)

	err := h.handle(t, h.user(t, "Facilitator"), "status_update", map[string]any{"status": "napping"})
	if err == nil {
		t.Fatal("expected an unknown status to be rejected")
	}
}

func TestOnlyTheAuthorMayEditNoteContent(t *testing.T) {
	h := newHarness(t)

	author := h.user(t, "Author")
	other := h.user(t, "Someone Else")

	noteID := h.createNote(t, author, "my own thought")

	err := h.handle(t, other, "note_update", map[string]any{
		"id":      noteID.String(),
		"content": "not my thought",
	})

	assertErrorEvent(t, err, "you can only change your own notes")

	note, getErr := dal.NoteGet(context.Background(), h.db, noteID)
	if getErr != nil {
		t.Fatalf("failed to re-read note: %v", getErr)
	}

	if note.Content != "my own thought" {
		t.Errorf("content was changed to %q despite the rejection", note.Content)
	}
}

func TestOnlyTheAuthorMayAttachAGif(t *testing.T) {
	h := newHarness(t)

	author := h.user(t, "Author")
	other := h.user(t, "Someone Else")

	noteID := h.createNote(t, author, "my own thought")

	err := h.handle(t, other, "note_update", map[string]any{
		"id":      noteID.String(),
		"img_url": "https://example.com/cat.gif",
	})

	assertErrorEvent(t, err, "you can only change your own notes")
}

func TestAnyoneMayMoveANote(t *testing.T) {
	h := newHarness(t)

	author := h.user(t, "Author")
	other := h.user(t, "Someone Else")

	noteID := h.createNote(t, author, "my own thought")

	// Grouping is a shared activity - moving someone else's note is the point.
	err := h.handle(t, other, "note_update", map[string]any{
		"id":        noteID.String(),
		"column_id": h.columns[1].ID.String(),
		"group_id":  uuid.New().String(),
	})

	if err != nil {
		t.Fatalf("expected a move by another user to be allowed, got %v", err)
	}

	if evt := h.next(t); evt.Name != "note_updated" {
		t.Errorf("expected note_updated, got %s", evt.Name)
	}

	note, getErr := dal.NoteGet(context.Background(), h.db, noteID)
	if getErr != nil {
		t.Fatalf("failed to re-read note: %v", getErr)
	}

	if note.ColumnID != h.columns[1].ID {
		t.Errorf("note did not move: still in column %s", note.ColumnID)
	}
}

func TestOnlyTheAuthorMayDeleteANote(t *testing.T) {
	h := newHarness(t)

	author := h.user(t, "Author")
	other := h.user(t, "Someone Else")

	noteID := h.createNote(t, author, "my own thought")

	assertErrorEvent(
		t,
		h.handle(t, other, "note_delete", map[string]any{"id": noteID.String()}),
		"you can only change your own notes",
	)

	if _, err := dal.NoteGet(context.Background(), h.db, noteID); err != nil {
		t.Errorf("note was deleted despite the rejection: %v", err)
	}

	if err := h.handle(t, author, "note_delete", map[string]any{"id": noteID.String()}); err != nil {
		t.Fatalf("the author should be able to delete their own note, got %v", err)
	}
}

func TestNotesFromAnotherRetroAreInvisible(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	author := h.user(t, "Author")

	// A note that lives in a different retro entirely.
	otherRetro, err := dal.RetroInsert(ctx, h.db, "Another retro", model.RetroColumns{
		{Title: "One", Description: ""},
		{Title: "Two", Description: ""},
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
		h.handle(t, author, "note_delete", map[string]any{"id": foreign.ID.String()}),
		"note not found",
	)

	assertErrorEvent(
		t,
		h.handle(t, author, "note_update", map[string]any{"id": foreign.ID.String(), "content": "reached in"}),
		"note not found",
	)

	if _, err := dal.NoteGet(ctx, h.db, foreign.ID); err != nil {
		t.Errorf("the foreign note was deleted: %v", err)
	}
}

func TestErrorEventsEchoTheClientRef(t *testing.T) {
	h := newHarness(t)

	author := h.user(t, "Author")
	other := h.user(t, "Someone Else")

	noteID := h.createNote(t, author, "my own thought")

	err := h.handle(t, other, "note_update", map[string]any{
		"id":      noteID.String(),
		"content": "not my thought",
		"ref":     "abc-123",
	})

	errorEvent, ok := err.(*event.ErrorEvent)
	if !ok {
		t.Fatalf("expected an ErrorEvent, got %T", err)
	}

	if errorEvent.Payload["ref"] != "abc-123" {
		t.Errorf("expected the ref to be echoed back, got %v", errorEvent.Payload["ref"])
	}
}

func TestConfirmationsEchoTheClientRef(t *testing.T) {
	h := newHarness(t)

	if err := h.handle(t, h.user(t, "Author"), "note_create", map[string]any{
		"column_id": h.columns[0].ID.String(),
		"content":   "a thought",
		"ref":       "xyz-789",
	}); err != nil {
		t.Fatalf("note_create failed: %v", err)
	}

	if got := h.next(t).Payload["ref"]; got != "xyz-789" {
		t.Errorf("expected the ref to be echoed back, got %v", got)
	}
}

func TestNotesAreOnlyObfuscatedDuringBrainstorm(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	author := h.user(t, "Author")

	// Brainstorm: other people see noise.
	h.createNote(t, author, "secret thought")

	if err := dal.RetroUpdateStatus(ctx, h.db, h.retro.ID, model.RetroStatusGroup); err != nil {
		t.Fatalf("failed to advance the retro: %v", err)
	}

	if err := h.handle(t, author, "note_create", map[string]any{
		"column_id": h.columns[0].ID.String(),
		"content":   "open thought",
	}); err != nil {
		t.Fatalf("note_create failed: %v", err)
	}

	// Past brainstorm, note_created must not scramble the content any more.
	if got := h.next(t).Payload["content"]; got != "open thought" {
		t.Errorf("expected the content in the clear after brainstorm, got %q", got)
	}
}

func TestUnknownEventsAreRejected(t *testing.T) {
	h := newHarness(t)

	if err := h.handle(t, h.user(t, "Author"), "drop_database", nil); err == nil {
		t.Error("expected an unknown event name to be rejected")
	}
}
