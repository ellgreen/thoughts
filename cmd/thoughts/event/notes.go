package event

import (
	"context"
	"log/slog"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

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

		note, err := dal.NoteInsert(ctx, db, retroID, user.ID, req.ColumnID, req.Content)
		if err != nil {
			slog.Error("problem inserting note", "error", err)
			return newErrorEvent("problem inserting note")
		}

		b.dispatchUserDependent(newNoteCreatedEvent(note))

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
	return func(ctx context.Context, _ *model.User, payload Payload) error {
		retro, err := dal.RetroGet(ctx, db, retroID)
		if err != nil {
			slog.Error("problem getting retro", "error", err)
			return newErrorEvent("problem getting retro")
		}

		req, err := requests.FromMap[noteUpdateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		note, err := dal.NoteUpdate(ctx, db, req.NoteID, req.ColumnID, req.GroupID, req.Content, req.ImgURL, req.RemoveImgURL)
		if err != nil {
			slog.Error("problem updating note", "error", err)
			return newErrorEvent("problem updating note")
		}

		b.dispatchUserDependent(newNoteUpdatedEvent(note, retro))

		return nil
	}
}

type noteDeleteRequest struct {
	NoteID uuid.UUID `json:"id" validate:"required,uuid"`
}

func (b *Broker) handleNoteDelete(db *sqlx.DB) Handler {
	return func(ctx context.Context, _ *model.User, payload Payload) error {
		req, err := requests.FromMap[noteDeleteRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		if err := dal.NoteDelete(ctx, db, req.NoteID); err != nil {
			slog.Error("problem deleting note", "error", err)
			return newErrorEvent("problem deleting note")
		}

		b.dispatch(newNoteDeletedEvent(req.NoteID))

		return nil
	}
}

func newNoteCreatedEvent(note *model.Note) UserDependentEvent {
	return func(user *model.User) *Event {
		resource := resources.NoteFromModel(note, nil, user.ID, true)
		payload := resources.StructToMap(resource)

		return &Event{
			Name:    "note_created",
			Payload: payload,
		}
	}
}

func newNoteUpdatedEvent(note *model.Note, retro *model.Retro) UserDependentEvent {
	return func(user *model.User) *Event {
		resource := resources.NoteFromModel(note, nil, user.ID, retro.IsBrainstorming())
		payload := resources.StructToMap(resource)

		return &Event{
			Name:    "note_updated",
			Payload: payload,
		}
	}
}

func newNoteDeletedEvent(noteID uuid.UUID) *Event {
	return &Event{
		Name:    "note_deleted",
		Payload: Payload{"id": noteID},
	}
}
