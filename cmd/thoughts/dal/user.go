package dal

import (
	"context"
	"database/sql"
	"errors"
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

// UserGetOrCreate resolves the identity behind a name, creating it on first
// sight. Auth is name-only, so the name is the identity: logging in again has
// to land on the same row or the person loses ownership of their own notes.
func UserGetOrCreate(ctx context.Context, db *sqlx.DB, name string) (*model.User, error) {
	user := &model.User{}

	err := db.GetContext(ctx, user, "select * from users where name = ?", name)
	if err == nil {
		return user, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("%w: failed to get user by name: %w", ErrExecution, err)
	}

	return UserInsert(ctx, db, name)
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

func UserMap(ctx context.Context, db *sqlx.DB, ids []uuid.UUID) (map[uuid.UUID]*model.User, error) {
	userMap := make(map[uuid.UUID]*model.User, len(ids))
	if len(ids) == 0 {
		return userMap, nil
	}

	query, args, err := sqlx.In("select * from users where id in (?)", ids)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to build query: %w", ErrExecution, err)
	}

	var users []*model.User

	if err := db.SelectContext(ctx, &users, db.Rebind(query), args...); err != nil {
		return nil, fmt.Errorf("%w: failed to get users: %w", ErrExecution, err)
	}

	for _, user := range users {
		userMap[user.ID] = user
	}

	return userMap, nil
}
