package dal

import (
	"context"
	"fmt"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func VotesForUser(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	userID uuid.UUID,
) ([]*model.Vote, error) {
	votes := []*model.Vote{}
	if err := db.SelectContext(ctx, &votes, "select * from votes where retro_id = ? and user_id = ?", retroID, userID); err != nil {
		return nil, fmt.Errorf("%w: failed to get votes for user: %w", ErrExecution, err)
	}

	return votes, nil
}

func VotesForRetro(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
) ([]*model.Vote, error) {
	votes := []*model.Vote{}
	if err := db.SelectContext(ctx, &votes, "select * from votes where retro_id = ?", retroID); err != nil {
		return nil, fmt.Errorf("%w: failed to get votes for retro: %w", ErrExecution,
			err)
	}

	return votes, nil
}

func VoteInsert(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	userID uuid.UUID,
	groupID uuid.UUID,
) (*model.Vote, error) {
	vote := &model.Vote{
		ID:        uuid.New(),
		RetroID:   retroID,
		UserID:    userID,
		GroupID:   groupID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.NamedExecContext(ctx, `
		insert or ignore into votes
		(id, retro_id, user_id, group_id, created_at, updated_at)
		values
		(:id, :retro_id, :user_id, :group_id, :created_at, :updated_at)
	`, vote)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to insert vote: %w", ErrExecution, err)
	}

	return vote, nil
}

func VoteDelete(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	userID uuid.UUID,
	groupID uuid.UUID,
) error {
	_, err := db.ExecContext(ctx, `
		delete from votes
		where retro_id = $1 and user_id = $2 and group_id = $3
	`, retroID, userID, groupID)

	if err != nil {
		return fmt.Errorf("%w: failed to delete vote: %w", ErrExecution, err)
	}

	return nil
}
