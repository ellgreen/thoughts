package model

import (
	"time"

	"github.com/google/uuid"
)

type Vote struct {
	ID        uuid.UUID `db:"id"`
	RetroID   uuid.UUID `db:"retro_id"`
	UserID    uuid.UUID `db:"user_id"`
	GroupID   uuid.UUID `db:"group_id"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}
