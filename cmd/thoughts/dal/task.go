package dal

import (
	"context"
	"fmt"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func TaskInsert(ctx context.Context, db *sqlx.DB, retroID uuid.UUID, who, what, when string) (*model.Task, error) {
	task := &model.Task{
		ID:        uuid.New(),
		RetroID:   retroID,
		Who:       who,
		What:      what,
		When:      when,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.NamedExecContext(ctx, `
		insert into tasks
		(id, retro_id, who, what, "when", created_at, updated_at)
		values
		(:id, :retro_id, :who, :what, :when, :created_at, :updated_at)
	`, task)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to insert task: %w", ErrExecution, err)
	}

	return task, nil
}

func TaskList(ctx context.Context, db *sqlx.DB, retroID uuid.UUID) ([]*model.Task, error) {
	tasks := []*model.Task{}
	if err := db.SelectContext(ctx, &tasks, "select * from tasks where retro_id = ?", retroID); err != nil {
		return nil, fmt.Errorf("%w: failed to list tasks: %w", ErrExecution, err)
	}

	return tasks, nil
}
