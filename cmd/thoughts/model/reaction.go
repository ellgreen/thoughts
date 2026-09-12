package model

import (
	"time"

	"github.com/google/uuid"
)

type Reaction struct {
	ID        uuid.UUID `db:"id"`
	RetroID   uuid.UUID `db:"retro_id"`
	NoteID    uuid.UUID `db:"note_id"`
	UserID    uuid.UUID `db:"user_id"`
	Emoji     string    `db:"emoji"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}
