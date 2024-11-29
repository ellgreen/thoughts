package model

import (
	"time"

	"github.com/google/uuid"
)

type Note struct {
	ID        uuid.UUID `db:"id" json:"id"`
	RetroID   uuid.UUID `db:"retro_id" json:"retro_id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	ColumnID  uuid.UUID `db:"column_id" json:"column_id"`
	GroupID   uuid.UUID `db:"group_id" json:"group_id"`
	Content   string    `db:"content" json:"content"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}
