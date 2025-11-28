package resources

import (
	"github.com/ellgreen/thoughts/cmd/thoughts/ai"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
)

type User struct {
	Name      string `json:"name"`
	AIEnabled bool   `json:"ai_enabled"`
}

func UserFromModel(model *model.User) *User {
	return &User{
		Name:      model.Name,
		AIEnabled: ai.IsAvailable(),
	}
}
