package resources

import (
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/gif"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/samber/lo"
)

type RetroColumn struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
}

type Retro struct {
	ID                 uuid.UUID      `json:"id"`
	Title              string         `json:"title"`
	Status             string         `json:"status"`
	Columns            []*RetroColumn `json:"columns"`
	Unlisted           bool           `json:"unlisted"`
	MaxVotes           int            `json:"max_votes"`
	GIFsEnabled        bool           `json:"gifs_enabled"`
	CreatedAt          time.Time      `json:"created_at"`
	NoteCount          int            `json:"note_count"`
	TaskCount          int            `json:"task_count"`
	TaskCompletedCount int            `json:"task_completed_count"`
}

func RetroFromModel(m *model.Retro) *Retro {
	return &Retro{
		ID:     m.ID,
		Title:  m.Title,
		Status: string(m.Status),
		Columns: lo.Map(m.GetColumns(), func(item *model.RetroColumn, _ int) *RetroColumn {
			return &RetroColumn{
				ID:          item.ID,
				Title:       item.Title,
				Description: item.Description,
			}
		}),
		Unlisted:           m.Unlisted,
		MaxVotes:           m.MaxVotes,
		GIFsEnabled:        gif.IsAvailable(),
		CreatedAt:          m.CreatedAt,
		NoteCount:          m.NoteCount,
		TaskCount:          m.TaskCount,
		TaskCompletedCount: m.TaskCompletedCount,
	}
}
