package dal

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
)

type Stats struct {
	RetroCount int `db:"retro_count" json:"retro_count"`
	NoteCount  int `db:"note_count" json:"note_count"`
	TaskCount  int `db:"task_count" json:"task_count"`
}

func StatsGet(ctx context.Context, db *sqlx.DB) (*Stats, error) {
	stats := &Stats{}
	err := db.GetContext(ctx, stats, `
		select
			(select count(*) from retros) as retro_count,
			(select count(*) from notes) as note_count,
			(select count(*) from tasks) as task_count
	`)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to get stats: %w", ErrExecution, err)
	}

	return stats, nil
}
