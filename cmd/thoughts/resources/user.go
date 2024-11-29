package resources

import "github.com/ellgreen/thoughts/cmd/thoughts/model"

type User struct {
	Name string `json:"name"`
}

func UserFromModel(model *model.User) *User {
	return &User{
		Name: model.Name,
	}
}
