package event

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrEventHandling = errors.New("failed to handle event")
	ErrUnknownEvent  = errors.New("unknown event")
)

type Broker struct {
	handlers            map[string]Handler
	events              chan *Event
	userDependentEvents chan UserDependentEvent
}

func NewBroker(db *sqlx.DB, retroID uuid.UUID) *Broker {
	b := &Broker{
		handlers:            make(map[string]Handler),
		events:              make(chan *Event),
		userDependentEvents: make(chan UserDependentEvent),
	}

	b.register("status_update", b.handleStatusUpdate(db, retroID))
	b.register("note_create", b.handleNoteCreate(db, retroID))
	b.register("note_update", b.handleNoteUpdate(db, retroID))
	b.register("task_create", b.handleTaskCreate(db, retroID))

	return b
}

func (b *Broker) register(name string, handler Handler) {
	b.handlers[name] = handler
}

func (b *Broker) lookup(name string) (Handler, error) {
	handler, ok := b.handlers[name]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownEvent, name)
	}

	return handler, nil
}

func (b *Broker) Handle(ctx context.Context, user *model.User, message io.Reader) error {
	var event Event
	err := json.NewDecoder(message).Decode(&event)
	if err != nil {
		return fmt.Errorf("failed to decode event: %w", err)
	}

	handler, err := b.lookup(event.Name)
	if err != nil {
		return err
	}

	return handler(ctx, user, event.Payload)
}

func (b *Broker) dispatch(event *Event) {
	b.events <- event
}

func (b *Broker) Listen() <-chan *Event {
	return b.events
}

func (b *Broker) dispatchUserDependent(event UserDependentEvent) {
	b.userDependentEvents <- event
}

func (b *Broker) ListenUserDependent() <-chan UserDependentEvent {
	return b.userDependentEvents
}
