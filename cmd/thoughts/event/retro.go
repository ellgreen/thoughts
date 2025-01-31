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

type retroUpdateRequest struct {
	Title    string `json:"title" validate:"required,min=5,max=255"`
	Unlisted bool   `json:"unlisted"`
}

func (b *Broker) handleRetroUpdate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, _ *model.User, payload Payload) error {
		req, err := requests.FromMap[retroUpdateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		retro, err := dal.RetroUpdate(ctx, db, retroID, req.Title, req.Unlisted)
		if err != nil {
			slog.Error("problem updating retro", "error", err)
			return newErrorEvent("problem updating retro")
		}

		b.dispatch(newRetroUpdatedEvent(retro))

		return nil
	}
}

func newRetroUpdatedEvent(retro *model.Retro) *Event {
	resource := resources.RetroFromModel(retro)
	payload := resources.StructToMap(resource)

	return &Event{
		Name:    "retro_updated",
		Payload: payload,
	}
}
