package dal

import (
	"context"
	"fmt"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func ReactionsForNote(
	ctx context.Context,
	db *sqlx.DB,
	noteID uuid.UUID,
) ([]*model.Reaction, error) {
	reactions := []*model.Reaction{}
	if err := db.SelectContext(ctx, &reactions, "select * from reactions where note_id = ?", noteID); err != nil {
		return nil, fmt.Errorf("%w: failed to get reactions for note: %w", ErrExecution, err)
	}

	return reactions, nil
}

func ReactionsForRetro(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
) ([]*model.Reaction, error) {
	reactions := []*model.Reaction{}
	if err := db.SelectContext(ctx, &reactions, "select * from reactions where retro_id = ?", retroID); err != nil {
		return nil, fmt.Errorf("%w: failed to get reactions for retro: %w", ErrExecution, err)
	}

	return reactions, nil
}

func ReactionInsert(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	noteID uuid.UUID,
	userID uuid.UUID,
	emoji string,
) (*model.Reaction, error) {
	reaction := &model.Reaction{
		ID:        uuid.New(),
		RetroID:   retroID,
		NoteID:    noteID,
		UserID:    userID,
		Emoji:     emoji,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.NamedExecContext(ctx, `
		insert or ignore into reactions
		(id, retro_id, note_id, user_id, emoji, created_at, updated_at)
		values
		(:id, :retro_id, :note_id, :user_id, :emoji, :created_at, :updated_at)
	`, reaction)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to insert reaction: %w", ErrExecution, err)
	}

	return reaction, nil
}

func ReactionDelete(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	noteID uuid.UUID,
	userID uuid.UUID,
	emoji string,
) error {
	_, err := db.ExecContext(ctx, `
		delete from reactions
		where retro_id = $1 and note_id = $2 and user_id = $3 and emoji = $4
	`, retroID, noteID, userID, emoji)

	if err != nil {
		return fmt.Errorf("%w: failed to delete reaction: %w", ErrExecution, err)
	}

	return nil
}
