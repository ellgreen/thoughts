package resources

import (
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
)

type Task struct {
	ID   uuid.UUID `json:"id"`
	Who  string    `json:"who"`
	What string    `json:"what"`
	When string    `json:"when"`
}

func TaskFromModel(model *model.Task) *Task {
	return &Task{
		ID:   model.ID,
		Who:  model.Who,
		What: model.What,
		When: model.When,
	}
}
