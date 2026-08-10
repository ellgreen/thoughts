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

// Payload fields that change what a note says, as opposed to where it sits.
// Only the author may change these. Moving a note between columns and groups
// stays open to everyone, which is the whole point of the group stage.
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

		retro, err := dal.RetroGet(ctx, db, retroID)
		if err != nil {
			slog.Error("problem getting retro", "error", err)
			return newErrorEvent("problem getting retro")
		}

		note, err := dal.NoteInsert(ctx, db, retroID, user.ID, req.ColumnID, req.Content)
		if err != nil {
			slog.Error("problem inserting note", "error", err)
			return newErrorEvent("problem inserting note")
		}

		b.dispatchUserDependent(newNoteCreatedEvent(note, retro, refFrom(payload)))

		return nil
	}
}

type noteUpdateRequest struct {
	NoteID       uuid.UUID `json:"id" validate:"required,uuid"`
	ColumnID     uuid.UUID `json:"column_id" validate:"omitempty,required_with=group_id,uuid"`
	GroupID      uuid.UUID `json:"group_id" validate:"omitempty,uuid"`
	Content      string    `json:"content" validate:"omitempty,min=2,max=255"`
	ImgURL       string    `json:"img_url" validate:"omitempty,url"`
	RemoveImgURL bool      `json:"remove_img_url"`
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

		b.dispatchUserDependent(newNoteUpdatedEvent(note, retro, refFrom(payload)))

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

// authoriseNote checks that the note exists and belongs to this retro, and when
// requireOwner is set, that the caller wrote it. Without the retro check a
// crafted event could reach into a retro the caller is not even connected to.
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

func newNoteCreatedEvent(note *model.Note, retro *model.Retro, ref string) UserDependentEvent {
	return func(user *model.User) *Event {
		resource := resources.NoteFromModel(note, nil, user.ID, retro.IsBrainstorming())
		payload := resources.StructToMap(resource)

		return &Event{
			Name:    "note_created",
			Payload: withRef(payload, ref),
		}
	}
}

func newNoteUpdatedEvent(note *model.Note, retro *model.Retro, ref string) UserDependentEvent {
	return func(user *model.User) *Event {
		resource := resources.NoteFromModel(note, nil, user.ID, retro.IsBrainstorming())
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
