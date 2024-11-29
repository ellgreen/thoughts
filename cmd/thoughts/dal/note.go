package dal

import (
	"context"
	"fmt"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func NoteGet(ctx context.Context, db *sqlx.DB, id uuid.UUID) (*model.Note, error) {
	note := &model.Note{}
	if err := db.GetContext(ctx, note, "select * from notes where id = ?", id); err != nil {
		return nil, fmt.Errorf("%w: failed to get note: %w", ErrExecution, err)
	}

	return note, nil
}

func NoteInsert(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	userID uuid.UUID,
	columnID uuid.UUID,
	content string,
) (*model.Note, error) {
	note := &model.Note{
		ID:        uuid.New(),
		RetroID:   retroID,
		UserID:    userID,
		ColumnID:  columnID,
		GroupID:   uuid.New(),
		Content:   content,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.NamedExecContext(ctx, `
		insert into notes
		(id, retro_id, user_id, column_id, group_id, content, created_at, updated_at)
		values
		(:id, :retro_id, :user_id, :column_id, :group_id, :content, :created_at, :updated_at)
	`, note)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to insert note: %w", ErrExecution, err)
	}

	return note, nil
}

func NoteUpdate(
	ctx context.Context,
	db *sqlx.DB,
	id uuid.UUID,
	columnID uuid.UUID,
	groupID uuid.UUID,
	content string,
) (*model.Note, error) {
	note, err := NoteGet(ctx, db, id)
	if err != nil {
		return nil, err
	}

	if columnID != uuid.Nil {
		note.ColumnID = columnID
	}

	note.GroupID = groupID

	if note.GroupID == uuid.Nil {
		note.GroupID = uuid.New()
	}

	note.Content = content
	note.UpdatedAt = time.Now()

	_, err = db.NamedExecContext(ctx, `
		update notes
		set
			column_id = :column_id,
			group_id = :group_id,
			content = :content,
			updated_at = :updated_at
		where id = :id
	`, note)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to update note: %w", ErrExecution, err)
	}

	return note, nil
}

func NoteList(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
) ([]*model.Note, error) {
	notes := make([]*model.Note, 0)
	if err := db.SelectContext(ctx, &notes, "select * from notes where retro_id = ?", retroID); err != nil {
		return nil, fmt.Errorf("%w: failed to select notes: %w", ErrExecution, err)
	}

	return notes, nil
}
