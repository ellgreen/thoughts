package dal

import (
	"context"
	"fmt"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func RetroList(ctx context.Context, db *sqlx.DB, includeUnlisted bool) ([]*model.Retro, error) {
	where := ""
	if !includeUnlisted {
		where = " where unlisted = false"
	}

	retros := make([]*model.Retro, 0)
	if err := db.SelectContext(ctx, &retros, "select * from retros"+where+" order by updated_at desc limit 25"); err != nil {
		return nil, fmt.Errorf("%w: failed to select retros: %w", ErrExecution, err)
	}

	return retros, nil
}

func RetroGet(ctx context.Context, db *sqlx.DB, id uuid.UUID) (*model.Retro, error) {
	retro := &model.Retro{}
	if err := db.GetContext(ctx, retro, "select * from retros where id = ?", id); err != nil {
		return nil, fmt.Errorf("%w: failed to get retro: %w", ErrExecution, err)
	}

	return retro, nil
}

func RetroInsert(ctx context.Context, db *sqlx.DB, title string, columns model.RetroColumns, unlisted bool) (*model.Retro, error) {
	retro := &model.Retro{
		ID:        uuid.New(),
		Status:    model.RetroStatusBrainstorm,
		Title:     title,
		Columns:   columns.AssignIDs().ToJSON(),
		Unlisted:  unlisted,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.NamedExecContext(ctx, `
		insert into retros
		(id, status, title, columns, unlisted, created_at, updated_at)
		values
		(:id, :status, :title, :columns, :unlisted, :created_at, :updated_at)
	`, retro)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to insert retro: %w", ErrExecution, err)
	}

	return retro, nil
}

func RetroUpdate(ctx context.Context, db *sqlx.DB, id uuid.UUID, title string, unlisted bool) (*model.Retro, error) {
	retro, err := RetroGet(ctx, db, id)
	if err != nil {
		return nil, err
	}

	retro.Title = title
	retro.Unlisted = unlisted
	retro.UpdatedAt = time.Now()

	_, err = db.NamedExecContext(ctx, `
		update retros set
			title = :title,
			unlisted = :unlisted,
			updated_at = :updated_at
		where id = :id
	`, retro)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to update retro: %w", ErrExecution, err)
	}

	return retro, nil
}

func RetroUpdateStatus(ctx context.Context, db *sqlx.DB, id uuid.UUID, status model.RetroStatus) error {
	_, err := db.ExecContext(ctx, `
		update retros set status = ?, updated_at = ? where id = ?
	`, status, time.Now(), id)
	if err != nil {
		return fmt.Errorf("%w: failed to update retro status: %w", ErrExecution, err)
	}

	return nil
}
