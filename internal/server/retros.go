package server

import (
	"errors"
	"net/http"

	"github.com/ellgreen/thoughts/internal/store"
)

type retroSummaryResource struct {
	retroResource
	Notes       int `json:"notes"`
	Actions     int `json:"actions"`
	ActionsDone int `json:"actionsDone"`
}

type openActionResource struct {
	actionResource
	RetroID    string `json:"retroId"`
	RetroTitle string `json:"retroTitle"`
}

func newOpenActionResource(o store.OpenAction) openActionResource {
	return openActionResource{
		actionResource: actionResource{ID: o.ID, What: o.What, Who: o.Who, DueOn: o.DueOn},
		RetroID:        o.RetroID, RetroTitle: o.RetroTitle,
	}
}

func openActions(list []store.OpenAction) []openActionResource {
	out := make([]openActionResource, 0, len(list))
	for _, o := range list {
		out = append(out, newOpenActionResource(o))
	}
	return out
}

func summaries(list []store.RetroSummary) []retroSummaryResource {
	out := make([]retroSummaryResource, 0, len(list))
	for _, r := range list {
		out = append(out, retroSummaryResource{retroResource: newRetroResource(r.Retro), Notes: r.Notes, Actions: r.Actions, ActionsDone: r.ActionsDone})
	}
	return out
}

func (a *app) listRetros(w http.ResponseWriter, r *http.Request, _ store.User) {
	list, err := a.store.ListRetros(r.Context(), "", 30)
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"retros": summaries(list)})
}

func (a *app) createRetro(w http.ResponseWriter, r *http.Request, u store.User) {
	var in struct {
		Title   string `json:"title"`
		Columns []struct {
			Title       string `json:"title"`
			Description string `json:"description"`
		} `json:"columns"`
		Tags     []string `json:"tags"`
		Unlisted bool     `json:"unlisted"`
		TeamID   string   `json:"teamId"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	nr := store.NewRetro{Title: in.Title, Tags: in.Tags, Unlisted: in.Unlisted, TeamID: in.TeamID}
	for _, c := range in.Columns {
		nr.Columns = append(nr.Columns, store.ColumnInput{Title: c.Title, Description: c.Description})
	}
	retro, err := a.store.CreateRetro(r.Context(), u.ID, nr)
	if writeProblem(w, err) {
		return
	}
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, newRetroResource(retro))
}

func (a *app) getRetro(w http.ResponseWriter, r *http.Request, _ store.User) {
	retro, err := a.store.Retro(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "There's no retro at that link. Check it with whoever sent it.")
		return
	}
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, newRetroResource(retro))
}

func (a *app) exportRetro(w http.ResponseWriter, r *http.Request, _ store.User) {
	b, err := a.store.Board(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		fail(w, r, err)
		return
	}
	if b.Retro.Stage == store.Reflect {
		writeError(w, http.StatusConflict, "Notes are still hidden. Export once everyone has moved on from reflecting.")
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+fileName(b.Retro.Title)+`.md"`)
	_, _ = w.Write([]byte(markdown(b)))
}

func (a *app) listTags(w http.ResponseWriter, r *http.Request, _ store.User) {
	tags, err := a.store.Tags(r.Context())
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

func (a *app) tag(w http.ResponseWriter, r *http.Request, _ store.User) {
	tag := store.CleanTag(r.PathValue("tag"))
	list, err := a.store.ListRetros(r.Context(), tag, 100)
	if err != nil {
		fail(w, r, err)
		return
	}
	open, err := a.store.OpenActions(r.Context(), tag)
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tag": tag, "retros": summaries(list), "openActions": openActions(open)})
}

func writeProblem(w http.ResponseWriter, err error) bool {
	var p store.Problem
	if errors.As(err, &p) {
		writeError(w, http.StatusBadRequest, p.Error())
		return true
	}
	return false
}

type teamSummaryResource struct {
	teamResource
	Retros      int `json:"retros"`
	OpenActions int `json:"openActions"`
}

func (a *app) listTeams(w http.ResponseWriter, r *http.Request, _ store.User) {
	teams, err := a.store.Teams(r.Context())
	if err != nil {
		fail(w, r, err)
		return
	}
	out := make([]teamSummaryResource, 0, len(teams))
	for _, t := range teams {
		out = append(out, teamSummaryResource{teamResource: teamResource{ID: t.ID, Slug: t.Slug, Name: t.Name}, Retros: t.Retros, OpenActions: t.OpenActions})
	}
	writeJSON(w, http.StatusOK, map[string]any{"teams": out})
}

func (a *app) createTeam(w http.ResponseWriter, r *http.Request, _ store.User) {
	var in struct {
		Name    string `json:"name"`
		FromTag string `json:"fromTag"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	t, err := a.store.CreateTeam(r.Context(), in.Name, in.FromTag)
	if writeProblem(w, err) {
		return
	}
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, teamResource{ID: t.ID, Slug: t.Slug, Name: t.Name})
}

func (a *app) team(w http.ResponseWriter, r *http.Request, _ store.User) {
	t, err := a.store.TeamBySlug(r.Context(), r.PathValue("slug"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "There's no team at that link.")
		return
	}
	if err != nil {
		fail(w, r, err)
		return
	}
	retros, err := a.store.TeamRetros(r.Context(), t.ID)
	if err != nil {
		fail(w, r, err)
		return
	}
	open, err := a.store.TeamOpenActions(r.Context(), t.ID)
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"team": teamResource{ID: t.ID, Slug: t.Slug, Name: t.Name}, "retros": summaries(retros), "openActions": openActions(open),
	})
}
