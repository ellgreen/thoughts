package resources

import (
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/util"
	"github.com/google/uuid"
)

type ReactionSummary struct {
	Emoji       string `json:"emoji"`
	Count       int    `json:"count"`
	ReactedByMe bool   `json:"reacted_by_me"`
}

type Note struct {
	ID            uuid.UUID         `json:"id"`
	CreatedByMe   bool              `json:"created_by_me"`
	CreatedByName string            `json:"created_by_name"`
	ColumnID      uuid.UUID         `json:"column_id"`
	GroupID       uuid.UUID         `json:"group_id"`
	Content       string            `json:"content"`
	ImgURL        string            `json:"img_url"`
	Reactions     []ReactionSummary `json:"reactions"`
}

func NoteFromModel(
	note *model.Note,
	noteUser *model.User,
	authUserID uuid.UUID,
	obfuscate bool,
	reactions []*model.Reaction,
) *Note {
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
		ImgURL:        note.ImgURL.V,
		Reactions:     ReactionSummariesFromModel(reactions, authUserID),
	}
}

func ReactionSummariesFromModel(reactions []*model.Reaction, authUserID uuid.UUID) []ReactionSummary {
	type tally struct {
		count       int
		reactedByMe bool
	}

	byEmoji := map[string]*tally{}
	order := []string{}

	for _, reaction := range reactions {
		t, ok := byEmoji[reaction.Emoji]
		if !ok {
			t = &tally{}
			byEmoji[reaction.Emoji] = t
			order = append(order, reaction.Emoji)
		}

		t.count++
		if reaction.UserID == authUserID {
			t.reactedByMe = true
		}
	}

	summaries := make([]ReactionSummary, 0, len(order))
	for _, emoji := range order {
		t := byEmoji[emoji]
		summaries = append(summaries, ReactionSummary{
			Emoji:       emoji,
			Count:       t.count,
			ReactedByMe: t.reactedByMe,
		})
	}

	return summaries
}
