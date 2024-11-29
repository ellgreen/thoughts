package event

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
)

type Payload map[string]any

type Handler func(ctx context.Context, user *model.User, payload Payload) error

type Event struct {
	Name    string  `json:"name"`
	Payload Payload `json:"payload"`
}

var _ error = &ErrorEvent{}

type ErrorEvent struct {
	*Event
}

func (e *ErrorEvent) Error() string {
	return e.Payload["message"].(string)
}

func newErrorEvent(message string) *ErrorEvent {
	return &ErrorEvent{
		Event: &Event{
			Name: "error",
			Payload: Payload{
				"message": message,
			},
		},
	}
}

type UserDependentEvent func(user *model.User) *Event

func (e *Event) ToJSON() []byte {
	val, err := json.Marshal(e)
	if err != nil {
		slog.Error("failed to marshal event", "event", e, "error", err)
		return nil
	}

	return val
}
