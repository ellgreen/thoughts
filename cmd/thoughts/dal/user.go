package dal

import (
	"context"
	"fmt"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func UserGet(ctx context.Context, db *sqlx.DB, id uuid.UUID) (*model.User, error) {
	user := &model.User{}
	if err := db.GetContext(ctx, user, "select * from users where id = ?", id); err != nil {
		return nil, fmt.Errorf("%w: failed to get user: %w", ErrExecution, err)
	}

	return user, nil
}

func UserInsert(ctx context.Context, db *sqlx.DB, name string) (*model.User, error) {
	user := &model.User{
		ID:        uuid.New(),
		Name:      name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.NamedExecContext(ctx, `
		insert into users
		(id, name, created_at, updated_at)
		values
		(:id, :name, :created_at, :updated_at)
	`, user)

	if err != nil {
		return nil, fmt.Errorf("%w: failed to insert user: %w", ErrExecution, err)
	}

	return user, nil
}
