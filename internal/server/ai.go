package server

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/ellgreen/thoughts/internal/ai"
	"github.com/ellgreen/thoughts/internal/live"
	"github.com/ellgreen/thoughts/internal/store"
)

const aiWait = 2 * time.Minute

var aiStage = map[string]store.Stage{
	"groups":  store.Group,
	"names":   store.Group,
	"actions": store.Discuss,
	"recap":   store.Discuss,
}

func (a *app) aiTemplate(w http.ResponseWriter, r *http.Request, _ store.User) {
	if a.ai == nil {
		http.NotFound(w, r)
		return
	}
	var in struct {
		Theme string `json:"theme"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	theme := strings.TrimSpace(in.Theme)
	if n := utf8.RuneCountInString(theme); n < 2 || n > 120 {
		writeError(w, http.StatusBadRequest, "Give it a theme of a few words.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), aiWait)
	defer cancel()
	t, err := ai.MakeTemplate(ctx, a.ai, theme)
	if err != nil {
		writeError(w, http.StatusBadGateway, a.aiProblem(ctx, "template", err))
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (a *app) aiProblem(ctx context.Context, what string, err error) string {
	if errors.Is(err, ai.ErrDeclined) {
		return "The AI declined to suggest anything for this one."
	}
	status := ai.Status(err)
	slog.ErrorContext(ctx, "ai request failed", "driver", a.ai.Name(), "what", what, "status", status, "err", err)
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return "The AI service took more than two minutes to answer, so Thoughts stopped waiting. Try again in a moment."
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return "The AI service turned down the API key. Whoever runs Thoughts needs to check THOUGHTS_AI_API_KEY."
	case status == http.StatusNotFound:
		return "The AI service doesn't offer the model it was asked for. Whoever runs Thoughts needs to check THOUGHTS_AI_MODEL."
	case status == http.StatusTooManyRequests:
		return "The AI service is rate limiting this install, or its account is out of credit. Try again later."
	case status >= 500:
		return "The AI service is having problems of its own. Try again in a moment."
	}
	return "Couldn't get an answer from the AI service. Try again, and if it keeps happening, check the server log."
}

// suggest asks the model for a suggestion and then stores it through the
// hub. The model call happens outside the hub's lock, so the room carries on
// while it thinks.
func (a *app) suggest(ctx context.Context, hub *live.Hub, retroID string, raw json.RawMessage) error {
	if a.ai == nil {
		return store.Problem("AI isn't set up on this install.")
	}
	in, err := args[struct {
		Kind string `json:"kind"`
	}](raw)
	if err != nil {
		return err
	}
	stage, ok := aiStage[in.Kind]
	if !ok {
		return store.Problem("That isn't something the AI can suggest.")
	}
	if _, busy := a.aiBusy.LoadOrStore(retroID+in.Kind, true); busy {
		return store.Problem("Already working on that suggestion.")
	}
	defer a.aiBusy.Delete(retroID + in.Kind)

	b, err := a.store.Board(ctx, retroID)
	if err != nil {
		return err
	}
	if b.Retro.Stage != stage {
		return store.Problem("That suggestion is for the " + string(stage) + " stage.")
	}
	ctx, cancel := context.WithTimeout(ctx, aiWait)
	defer cancel()

	var payload any
	var recap string
	switch in.Kind {
	case "groups":
		payload, err = ai.SuggestGroups(ctx, a.ai, notesFor(b))
	case "names":
		payload, err = ai.NameGroups(ctx, a.ai, groupsFor(b, func(n int, title string) bool { return n > 1 && title == "" }))
	case "actions":
		var existing []string
		for _, x := range b.Actions {
			existing = append(existing, x.What)
		}
		payload, err = ai.DraftActions(ctx, a.ai, topGroups(b, 5), existing)
	case "recap":
		var actions []string
		for _, x := range b.Actions {
			actions = append(actions, x.What)
		}
		recap, err = ai.Recap(ctx, a.ai, b.Retro.Title, topGroups(b, 8), actions)
	}
	if err != nil {
		return store.Problem(a.aiProblem(ctx, in.Kind, err))
	}
	if in.Kind == "actions" && isEmpty(payload) {
		return store.Problem("The AI didn't find anything here that needs an action.")
	}
	if in.Kind != "recap" && isEmpty(payload) {
		return store.Problem("Nothing to suggest here yet.")
	}

	return hub.Update(func(v int64) (live.Render, error) {
		if in.Kind == "recap" {
			if err := a.store.SetRecap(ctx, retroID, recap); err != nil {
				return nil, err
			}
		} else {
			body, _ := json.Marshal(payload)
			if err := a.store.SaveSuggestion(ctx, retroID, in.Kind, body); err != nil {
				return nil, err
			}
		}
		return a.boardRender(ctx, retroID, v)
	})
}

func isEmpty(v any) bool {
	b, _ := json.Marshal(v)
	return string(b) == "null" || string(b) == "[]"
}

func notesFor(b store.Board) []ai.Note {
	columns := map[string]string{}
	for _, c := range b.Retro.Columns {
		columns[c.ID] = c.Title
	}
	groupColumn := map[string]string{}
	for _, g := range b.Groups {
		groupColumn[g.ID] = g.ColumnID
	}
	out := make([]ai.Note, 0, len(b.Notes))
	for _, n := range b.Notes {
		out = append(out, ai.Note{ID: n.ID, Column: columns[groupColumn[n.GroupID]], Text: n.Content})
	}
	return out
}

func groupsFor(b store.Board, keep func(notes int, title string) bool) []ai.GroupNotes {
	byGroup := map[string][]string{}
	for _, n := range b.Notes {
		byGroup[n.GroupID] = append(byGroup[n.GroupID], n.Content)
	}
	votes := map[string]int{}
	for _, v := range b.Votes {
		votes[v.GroupID] += v.Count
	}
	var out []ai.GroupNotes
	for _, g := range b.Groups {
		if notes := byGroup[g.ID]; len(notes) > 0 && keep(len(notes), g.Title) {
			out = append(out, ai.GroupNotes{ID: g.ID, Title: g.Title, Notes: notes, Votes: votes[g.ID]})
		}
	}
	return out
}

func topGroups(b store.Board, n int) []ai.GroupNotes {
	all := groupsFor(b, func(int, string) bool { return true })
	slices.SortStableFunc(all, func(x, y ai.GroupNotes) int { return cmp.Compare(y.Votes, x.Votes) })
	var out []ai.GroupNotes
	for _, g := range all {
		if g.Votes > 0 && len(out) < n {
			out = append(out, g)
		}
	}
	return out
}

// applySuggestion carries out a suggestion, or one of its items, with the same rules as doing it
// by hand, as the person who applied it. Each step commits on its own, so
// the stage is checked first and a step the board has outgrown is skipped
// rather than abandoning the rest: the hub broadcasts nothing for an error.
func applySuggestion(ctx context.Context, s *store.Store, retroID string, u store.User, id string, item *int) error {
	b, err := s.Board(ctx, retroID)
	if err != nil {
		return err
	}
	i := slices.IndexFunc(b.Suggestions, func(sg store.Suggestion) bool { return sg.ID == id })
	if i < 0 {
		return store.ErrNotFound
	}
	if stage := aiStage[b.Suggestions[i].Kind]; b.Retro.Stage != stage {
		return store.Problem("That suggestion is for the " + string(stage) + " stage.")
	}
	sg, err := takeSuggestion(ctx, s, retroID, id, item)
	if err != nil {
		return err
	}
	switch sg.Kind {
	case "groups":
		var groups []ai.Group
		if err := json.Unmarshal(sg.Payload, &groups); err != nil {
			return err
		}
		groupOf := map[string]string{}
		for _, n := range b.Notes {
			groupOf[n.ID] = n.GroupID
		}
		for _, g := range groups {
			target, ok := groupOf[g.NoteIDs[0]]
			if !ok {
				continue
			}
			for _, id := range g.NoteIDs[1:] {
				if _, ok := groupOf[id]; !ok {
					continue
				}
				if err := s.MoveNote(ctx, retroID, id, u.ID, "", target); err != nil {
					if outgrown(err) {
						continue
					}
					return err
				}
				groupOf[id] = target
			}
			if err := s.NameGroup(ctx, retroID, target, g.Title); err != nil && !outgrown(err) {
				return err
			}
		}
	case "names":
		var names []ai.Name
		if err := json.Unmarshal(sg.Payload, &names); err != nil {
			return err
		}
		for _, n := range names {
			if err := s.NameGroup(ctx, retroID, n.GroupID, n.Title); err != nil && !outgrown(err) {
				return err
			}
		}
	case "actions":
		var actions []ai.Action
		if err := json.Unmarshal(sg.Payload, &actions); err != nil {
			return err
		}
		for _, x := range actions {
			if _, err := s.AddAction(ctx, retroID, store.ActionInput{What: x.What}); err != nil && !outgrown(err) {
				return err
			}
		}
	}
	return nil
}

func takeSuggestion(ctx context.Context, s *store.Store, retroID, id string, item *int) (store.Suggestion, error) {
	if item == nil {
		return s.TakeSuggestion(ctx, retroID, id)
	}
	return s.TakeSuggestionItem(ctx, retroID, id, *item)
}

func outgrown(err error) bool {
	var problem store.Problem
	return errors.Is(err, store.ErrNotFound) || errors.As(err, &problem)
}
