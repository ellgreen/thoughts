package event

import (
	"context"
	"log/slog"
	"slices"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var validTransitions = map[model.RetroStatus][]model.RetroStatus{
	model.RetroStatusBrainstorm: {model.RetroStatusGroup},
	model.RetroStatusGroup:      {model.RetroStatusBrainstorm, model.RetroStatusVote},
	model.RetroStatusVote:       {model.RetroStatusGroup, model.RetroStatusDiscuss},
	model.RetroStatusDiscuss:    {model.RetroStatusVote},
}

type statusUpdateRequest struct {
	Status string `json:"status" validate:"required,oneof=brainstorm group vote discuss"`
}

func (b *Broker) handleStatusUpdate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, user *model.User, payload Payload) error {
		req, err := requests.FromMap[statusUpdateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		newRetroStatus := model.RetroStatus(req.Status)

		retro, err := dal.RetroGet(ctx, db, retroID)
		if err != nil {
			slog.Error("problem getting retro", "error", err)
			return newErrorEvent("problem getting retro")
		}

		if newRetroStatus == retro.Status {
			return newErrorEvent("status is already set to " + string(newRetroStatus))
		}

		if !slices.Contains(validTransitions[retro.Status], newRetroStatus) {
			return newErrorEvent("invalid status transition")
		}

		if err := dal.RetroUpdateStatus(ctx, db, retroID, newRetroStatus); err != nil {
			slog.Error("problem updating retro status", "error", err)
			return newErrorEvent("problem updating retro status")
		}

		b.dispatch(newStatusUpdatedEvent(newRetroStatus))

		return nil
	}
}

func newStatusUpdatedEvent(status model.RetroStatus) *Event {
	return &Event{
		Name: "status_updated",
		Payload: Payload{
			"status": status,
		},
	}
}
