package resources

import (
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/util"
	"github.com/google/uuid"
)

type Note struct {
	ID            uuid.UUID `json:"id"`
	CreatedByMe   bool      `json:"created_by_me"`
	CreatedByName string    `json:"created_by_name"`
	ColumnID      uuid.UUID `json:"column_id"`
	GroupID       uuid.UUID `json:"group_id"`
	Content       string    `json:"content"`
}

func NoteFromModel(note *model.Note, noteUser *model.User, authUserID uuid.UUID, obfuscate bool) *Note {
	createdByMe := note.UserID == authUserID

	content := note.Content
	if obfuscate && !createdByMe {
		content = util.Obfuscate(content)
	}

	createdByName := "unknown"
	if noteUser != nil {
		createdByName = noteUser.Name
	}

	return &Note{
		ID:            note.ID,
		CreatedByMe:   createdByMe,
		CreatedByName: createdByName,
		ColumnID:      note.ColumnID,
		GroupID:       note.GroupID,
		Content:       content,
	}
}
