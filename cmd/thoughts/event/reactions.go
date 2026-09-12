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

// Kept in step with ui/src/lib/reactions.ts: reactions are a fixed set, not
// free-form emoji, so both sides list the same six.
var allowedReactionEmoji = map[string]bool{
	"👍": true,
	"🎉": true,
	"😂": true,
	"😮": true,
	"👀": true,
	"❤️": true,
}

type reactionToggleRequest struct {
	NoteID uuid.UUID `json:"note_id" validate:"required,uuid"`
	Emoji  string    `json:"emoji" validate:"required"`
	Value  bool      `json:"value"`
}

func (b *Broker) handleReactionToggle(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, user *model.User, payload Payload) error {
		req, err := requests.FromMap[reactionToggleRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		if !allowedReactionEmoji[req.Emoji] {
			return newErrorEvent("that's not a reaction we support")
		}

		if err := authoriseNote(ctx, db, user, retroID, req.NoteID, false); err != nil {
			return err
		}

		retro, err := dal.RetroGet(ctx, db, retroID)
		if err != nil {
			slog.Error("problem getting retro", "error", err)
			return newErrorEvent("problem getting retro")
		}

		if retro.Status != model.RetroStatusDiscuss {
			return newErrorEvent("reactions are only available while discussing")
		}

		if req.Value {
			if _, err := dal.ReactionInsert(ctx, db, retroID, req.NoteID, user.ID, req.Emoji); err != nil {
				slog.Error("problem inserting reaction", "error", err)
				return newErrorEvent("problem adding reaction")
			}
		} else {
			if err := dal.ReactionDelete(ctx, db, retroID, req.NoteID, user.ID, req.Emoji); err != nil {
				slog.Error("problem deleting reaction", "error", err)
				return newErrorEvent("problem removing reaction")
			}
		}

		reactions, err := dal.ReactionsForNote(ctx, db, req.NoteID)
		if err != nil {
			slog.Error("problem getting note reactions", "error", err)
			return newErrorEvent("problem updating reactions")
		}

		b.dispatchUserDependent(newNoteReactionsUpdatedEvent(req.NoteID, reactions, refFrom(payload)))

		return nil
	}
}

func newNoteReactionsUpdatedEvent(noteID uuid.UUID, reactions []*model.Reaction, ref string) UserDependentEvent {
	return func(user *model.User) *Event {
		return &Event{
			Name: "note_reactions_updated",
			Payload: withRef(Payload{
				"id":        noteID,
				"reactions": resources.ReactionSummariesFromModel(reactions, user.ID),
			}, ref),
		}
	}
}
