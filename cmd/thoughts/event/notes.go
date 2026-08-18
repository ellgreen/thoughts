package event

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var noteContentFields = []string{"content", "img_url", "remove_img_url"}

type noteCreateRequest struct {
	ColumnID uuid.UUID `json:"column_id" validate:"required,uuid"`
	Content  string    `json:"content" validate:"required,min=2,max=255"`
}

func (b *Broker) handleNoteCreate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, user *model.User, payload Payload) error {
		req, err := requests.FromMap[noteCreateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		retro, note, err := b.createNote(ctx, db, retroID, user, req)
		if err != nil {
			return err
		}

		b.dispatchUserDependent(newNoteCreatedEvent(note, user, retro, refFrom(payload)))

		return nil
	}
}

func (b *Broker) createNote(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	user *model.User,
	req *noteCreateRequest,
) (*model.Retro, *model.Note, error) {
	b.columnsMu.Lock()
	defer b.columnsMu.Unlock()

	retro, err := dal.RetroGet(ctx, db, retroID)
	if err != nil {
		slog.Error("problem getting retro", "error", err)
		return nil, nil, newErrorEvent("problem getting retro")
	}

	if retro.GetColumns().Find(req.ColumnID) == nil {
		return nil, nil, newErrorEvent("that column no longer exists")
	}

	note, err := dal.NoteInsert(ctx, db, retroID, user.ID, req.ColumnID, req.Content)
	if err != nil {
		slog.Error("problem inserting note", "error", err)
		return nil, nil, newErrorEvent("problem inserting note")
	}

	return retro, note, nil
}

type noteUpdateRequest struct {
	NoteID   uuid.UUID `json:"id" validate:"required,uuid"`
	ColumnID uuid.UUID `json:"column_id" validate:"omitempty,required_with=group_id,uuid"`
	GroupID  uuid.UUID `json:"group_id" validate:"omitempty,uuid"`
	Content  string    `json:"content" validate:"omitempty,min=2,max=255"`
	// These are user-supplied now, and a browser blocks mixed content anyway.
	ImgURL       string `json:"img_url" validate:"omitempty,url,startswith=https://,max=2048"`
	RemoveImgURL bool   `json:"remove_img_url"`
}

func (b *Broker) handleNoteUpdate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, user *model.User, payload Payload) error {
		retro, err := dal.RetroGet(ctx, db, retroID)
		if err != nil {
			slog.Error("problem getting retro", "error", err)
			return newErrorEvent("problem getting retro")
		}

		req, err := requests.FromMap[noteUpdateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		if err := authoriseNote(ctx, db, user, retroID, req.NoteID, payloadHasAny(payload, noteContentFields...)); err != nil {
			return err
		}

		note, err := dal.NoteUpdate(ctx, db, req.NoteID, req.ColumnID, req.GroupID, req.Content, req.ImgURL, req.RemoveImgURL)
		if err != nil {
			slog.Error("problem updating note", "error", err)
			return newErrorEvent("problem updating note")
		}

		// Not the acting user: grouping and moving are allowed on other
		// people's notes, so the author has to be looked up.
		author, err := dal.UserGet(ctx, db, note.UserID)
		if err != nil {
			slog.Error("problem getting note author", "error", err)
			return newErrorEvent("problem updating note")
		}

		b.dispatchUserDependent(newNoteUpdatedEvent(note, author, retro, refFrom(payload)))

		return nil
	}
}

type noteDeleteRequest struct {
	NoteID uuid.UUID `json:"id" validate:"required,uuid"`
}

func (b *Broker) handleNoteDelete(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, user *model.User, payload Payload) error {
		req, err := requests.FromMap[noteDeleteRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		if err := authoriseNote(ctx, db, user, retroID, req.NoteID, true); err != nil {
			return err
		}

		if err := dal.NoteDelete(ctx, db, req.NoteID); err != nil {
			slog.Error("problem deleting note", "error", err)
			return newErrorEvent("problem deleting note")
		}

		b.dispatch(newNoteDeletedEvent(req.NoteID, refFrom(payload)))

		return nil
	}
}

func authoriseNote(
	ctx context.Context,
	db *sqlx.DB,
	user *model.User,
	retroID uuid.UUID,
	noteID uuid.UUID,
	requireOwner bool,
) error {
	note, err := dal.NoteGet(ctx, db, noteID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return newErrorEvent("note not found")
		}

		slog.Error("problem getting note", "error", err)

		return newErrorEvent("problem getting note")
	}

	if note.RetroID != retroID {
		return newErrorEvent("note not found")
	}

	if requireOwner && note.UserID != user.ID {
		return newErrorEvent("you can only change your own notes")
	}

	return nil
}

func payloadHasAny(payload Payload, keys ...string) bool {
	for _, key := range keys {
		if _, ok := payload[key]; ok {
			return true
		}
	}

	return false
}

// author, not the person receiving the event: NoteFromModel resolves
// created_by_name from it, and passing nil made every broadcast note read
// "unknown" for everyone once it was moved or edited.
func newNoteCreatedEvent(note *model.Note, author *model.User, retro *model.Retro, ref string) UserDependentEvent {
	return func(user *model.User) *Event {
		resource := resources.NoteFromModel(note, author, user.ID, retro.IsBrainstorming())
		payload := resources.StructToMap(resource)

		return &Event{
			Name:    "note_created",
			Payload: withRef(payload, ref),
		}
	}
}

func newNoteUpdatedEvent(note *model.Note, author *model.User, retro *model.Retro, ref string) UserDependentEvent {
	return func(user *model.User) *Event {
		resource := resources.NoteFromModel(note, author, user.ID, retro.IsBrainstorming())
		payload := resources.StructToMap(resource)

		return &Event{
			Name:    "note_updated",
			Payload: withRef(payload, ref),
		}
	}
}

func newNoteDeletedEvent(noteID uuid.UUID, ref string) *Event {
	return &Event{
		Name:    "note_deleted",
		Payload: withRef(Payload{"id": noteID}, ref),
	}
}
