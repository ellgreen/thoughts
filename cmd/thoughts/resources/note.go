package resources

import (
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/util"
	"github.com/google/uuid"
)

type Note struct {
	ID          uuid.UUID `json:"id"`
	CreatedByMe bool      `json:"created_by_me"`
	ColumnID    uuid.UUID `json:"column_id"`
	GroupID     uuid.UUID `json:"group_id"`
	Content     string    `json:"content"`
}

func NoteFromModel(note *model.Note, userID uuid.UUID, obfuscate bool) *Note {
	createdByMe := note.UserID == userID

	content := note.Content
	if obfuscate && !createdByMe {
		content = util.Obfuscate(content)
	}

	return &Note{
		ID:          note.ID,
		CreatedByMe: createdByMe,
		ColumnID:    note.ColumnID,
		GroupID:     note.GroupID,
		Content:     content,
	}
}
