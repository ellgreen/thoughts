package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type (
	RetroStatus string

	Retro struct {
		ID                 uuid.UUID   `db:"id"`
		Status             RetroStatus `db:"status"`
		Title              string      `db:"title"`
		Columns            string      `db:"columns"`
		Unlisted           bool        `db:"unlisted"`
		MaxVotes           int         `db:"max_votes"`
		CreatedAt          time.Time   `db:"created_at"`
		UpdatedAt          time.Time   `db:"updated_at"`
		NoteCount          int         `db:"note_count"`
		TaskCount          int         `db:"task_count"`
		TaskCompletedCount int         `db:"task_completed_count"`
		Tags               []string    `db:"-"`
	}

	RetroColumn struct {
		ID          uuid.UUID `db:"id" json:"id"`
		Title       string    `db:"title" json:"title"`
		Description string    `db:"description" json:"description"`
	}

	RetroColumns []*RetroColumn
)

const (
	RetroStatusBrainstorm RetroStatus = "brainstorm"
	RetroStatusGroup      RetroStatus = "group"
	RetroStatusVote       RetroStatus = "vote"
	RetroStatusDiscuss    RetroStatus = "discuss"
)

func (r *Retro) GetColumns() RetroColumns {
	var cols RetroColumns
	if err := json.Unmarshal([]byte(r.Columns), &cols); err != nil {
		panic(err)
	}

	return cols
}

func (r *Retro) IsBrainstorming() bool {
	return r.Status == RetroStatusBrainstorm
}

// Find returns the column with the given id, or nil. Value receiver because
// GetColumns hands back a value, not a pointer.
func (rc RetroColumns) Find(id uuid.UUID) *RetroColumn {
	for _, column := range rc {
		if column.ID == id {
			return column
		}
	}

	return nil
}

// Without returns a copy with the given column removed.
func (rc RetroColumns) Without(id uuid.UUID) RetroColumns {
	remaining := make(RetroColumns, 0, len(rc))

	for _, column := range rc {
		if column.ID != id {
			remaining = append(remaining, column)
		}
	}

	return remaining
}

func (rc *RetroColumns) AssignIDs() *RetroColumns {
	for _, c := range *rc {
		c.ID = uuid.New()
	}

	return rc
}

func (rc *RetroColumns) ToJSON() string {
	colJSON, err := json.Marshal(rc)
	if err != nil {
		panic(err)
	}

	return string(colJSON)
}
