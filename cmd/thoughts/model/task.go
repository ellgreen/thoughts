package model

import (
	"time"

	"github.com/google/uuid"
)

type Task struct {
	ID        uuid.UUID `db:"id"`
	RetroID   uuid.UUID `db:"retro_id"`
	Who       string    `db:"who"`
	What      string    `db:"what"`
	When      string    `db:"when"`
	Completed bool      `db:"completed"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}
