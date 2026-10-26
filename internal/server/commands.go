package server

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ellgreen/thoughts/internal/store"
)

type command func(ctx context.Context, s *store.Store, retroID string, u store.User, args json.RawMessage) error

func args[T any](raw json.RawMessage) (T, error) {
	var v T
	if len(raw) == 0 {
		return v, nil
	}
	if err := json.Unmarshal(raw, &v); err != nil {
		return v, store.Problem("That request didn't make sense to the server. Reload the page and try again.")
	}
	return v, nil
}

// on adapts a typed handler to a command, decoding its arguments first.
func on[T any](fn func(ctx context.Context, s *store.Store, retroID string, u store.User, a T) error) command {
	return func(ctx context.Context, s *store.Store, retroID string, u store.User, raw json.RawMessage) error {
		a, err := args[T](raw)
		if err != nil {
			return err
		}
		return fn(ctx, s, retroID, u, a)
	}
}

type secondsArgs struct {
	Seconds int `json:"seconds"`
}

type idArgs struct {
	ID string `json:"id"`
}

type suggestionArgs struct {
	ID   string `json:"id"`
	Item *int   `json:"item"`
}

type columnArgs struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type actionArgs struct {
	ID    string `json:"id"`
	What  string `json:"what"`
	Who   string `json:"who"`
	DueOn string `json:"dueOn"`
	Done  bool   `json:"done"`
}

var commands = map[string]command{
	"retro.update": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a struct {
		Title    string   `json:"title"`
		MaxVotes int      `json:"maxVotes"`
		Unlisted bool     `json:"unlisted"`
		Tags     []string `json:"tags"`
		TeamID   string   `json:"teamId"`
	}) error {
		return s.UpdateRetro(ctx, id, store.RetroSettings{Title: a.Title, MaxVotes: a.MaxVotes, Unlisted: a.Unlisted, Tags: a.Tags, TeamID: a.TeamID})
	}),
	"timer.start": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a secondsArgs) error {
		return s.StartTimer(ctx, id, a.Seconds)
	}),
	"timer.add": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a secondsArgs) error {
		return s.AddTime(ctx, id, a.Seconds)
	}),
	"timer.pause": on(func(ctx context.Context, s *store.Store, id string, _ store.User, _ struct{}) error {
		return s.PauseTimer(ctx, id)
	}),
	"timer.resume": on(func(ctx context.Context, s *store.Store, id string, _ store.User, _ struct{}) error {
		return s.ResumeTimer(ctx, id)
	}),
	"timer.clear": on(func(ctx context.Context, s *store.Store, id string, _ store.User, _ struct{}) error {
		return s.ClearTimer(ctx, id)
	}),
	"ready.set": on(func(ctx context.Context, s *store.Store, id string, u store.User, a struct {
		Ready bool `json:"ready"`
	}) error {
		return s.SetReady(ctx, id, u.ID, a.Ready)
	}),
	"spotlight.set": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a struct {
		GroupID string `json:"groupId"`
	}) error {
		return s.Spotlight(ctx, id, a.GroupID)
	}),
	"lastTime.close": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a struct {
		ID      string `json:"id"`
		Outcome string `json:"outcome"`
	}) error {
		if a.Outcome != "done" && a.Outcome != "carried" && a.Outcome != "dropped" {
			return store.Problem("An earlier action can be done, carried over or dropped.")
		}
		return s.CloseEarlier(ctx, id, a.ID, a.Outcome)
	}),
	"stage.set": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a struct {
		Stage store.Stage `json:"stage"`
	}) error {
		return s.SetStage(ctx, id, a.Stage)
	}),
	"column.add": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a columnArgs) error {
		_, err := s.AddColumn(ctx, id, store.ColumnInput{Title: a.Title, Description: a.Description})
		return err
	}),
	"column.update": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a columnArgs) error {
		return s.UpdateColumn(ctx, id, a.ID, store.ColumnInput{Title: a.Title, Description: a.Description})
	}),
	"column.delete": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a idArgs) error {
		return s.DeleteColumn(ctx, id, a.ID)
	}),
	"note.add": on(func(ctx context.Context, s *store.Store, id string, u store.User, a struct {
		ColumnID string `json:"columnId"`
		Content  string `json:"content"`
	}) error {
		_, err := s.AddNote(ctx, id, u.ID, a.ColumnID, a.Content)
		return err
	}),
	"note.edit": on(func(ctx context.Context, s *store.Store, id string, u store.User, a struct {
		ID      string  `json:"id"`
		Content *string `json:"content"`
		ImgURL  *string `json:"imgUrl"`
	}) error {
		return s.EditNote(ctx, id, a.ID, u.ID, store.NoteEdit{Content: a.Content, ImgURL: a.ImgURL})
	}),
	"note.delete": on(func(ctx context.Context, s *store.Store, id string, u store.User, a idArgs) error {
		return s.DeleteNote(ctx, id, a.ID, u.ID)
	}),
	"note.move": on(func(ctx context.Context, s *store.Store, id string, u store.User, a struct {
		ID       string `json:"id"`
		ColumnID string `json:"columnId"`
		GroupID  string `json:"groupId"`
	}) error {
		return s.MoveNote(ctx, id, a.ID, u.ID, a.ColumnID, a.GroupID)
	}),
	"group.name": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}) error {
		return s.NameGroup(ctx, id, a.ID, a.Title)
	}),
	"vote.cast": on(func(ctx context.Context, s *store.Store, id string, u store.User, a struct {
		GroupID string `json:"groupId"`
		Delta   int    `json:"delta"`
	}) error {
		return s.CastVote(ctx, id, a.GroupID, u.ID, a.Delta)
	}),
	"reaction.set": on(func(ctx context.Context, s *store.Store, id string, u store.User, a struct {
		NoteID string `json:"noteId"`
		Emoji  string `json:"emoji"`
		On     bool   `json:"on"`
	}) error {
		return s.React(ctx, id, a.NoteID, u.ID, a.Emoji, a.On)
	}),
	"action.add": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a actionArgs) error {
		_, err := s.AddAction(ctx, id, store.ActionInput{What: a.What, Who: a.Who, DueOn: a.DueOn})
		return err
	}),
	"action.update": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a actionArgs) error {
		return s.UpdateAction(ctx, id, a.ID, store.ActionInput{What: a.What, Who: a.Who, DueOn: a.DueOn})
	}),
	"action.done": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a actionArgs) error {
		return s.SetActionDone(ctx, id, a.ID, a.Done)
	}),
	"action.delete": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a idArgs) error {
		return s.DeleteAction(ctx, id, a.ID)
	}),
	"ai.apply": on(func(ctx context.Context, s *store.Store, id string, u store.User, a suggestionArgs) error {
		return applySuggestion(ctx, s, id, u, a.ID, a.Item)
	}),
	"ai.dismiss": on(func(ctx context.Context, s *store.Store, id string, _ store.User, a suggestionArgs) error {
		_, err := takeSuggestion(ctx, s, id, a.ID, a.Item)
		return err
	}),
}

func unknownCommand(name string) error {
	return store.Problem(fmt.Sprintf("The server doesn't know how to %q. Reload the page to get the latest version.", name))
}
