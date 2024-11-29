package event

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
)

type taskCreateRequest struct {
	Who  string `json:"who" validate:"required,min=2,max=255"`
	What string `json:"what" validate:"required,min=2,max=255"`
	When string `json:"when" validate:"required,datetime=2006-01-02T15:04:05Z"`
}

func (b *Broker) handleTaskCreate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, user *model.User, payload Payload) error {
		req, err := requests.FromMap[taskCreateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		task, err := dal.TaskInsert(ctx, db, retroID, req.Who, req.What, req.When)
		if err != nil {
			slog.Error("problem inserting task", "error", err)
			return newErrorEvent("problem inserting task")
		}

		b.dispatch(newTaskCreatedEvent(task))

		return nil
	}
}

func newTaskCreatedEvent(task *model.Task) *Event {
	resource := resources.TaskFromModel(task)
	payload := resources.StructToMap(resource)

	return &Event{
		Name:    "task_created",
		Payload: payload,
	}
}
