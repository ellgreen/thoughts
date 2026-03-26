package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	"github.com/samber/lo"
)

func TagSuggestions(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tags, err := dal.TagSuggestions(r.Context(), db)
		if err != nil {
			slog.Error("problem fetching tag suggestions", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, tags)
	})
}

type tagRetrosResponse struct {
	Stats     *dal.TagStats      `json:"stats"`
	Retros    []*resources.Retro `json:"retros"`
	OpenTasks []openTaskResource `json:"open_tasks"`
}

type openTaskResource struct {
	resources.Task
	RetroTitle string `json:"retro_title"`
}

func TagRetros(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tag := mux.Vars(r)["tag"]

		stats, err := dal.TagGetStats(r.Context(), db, tag)
		if err != nil {
			slog.Error("problem fetching tag stats", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		retros, err := dal.RetrosByTag(r.Context(), db, tag)
		if err != nil {
			slog.Error("problem fetching retros by tag", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		for _, retro := range retros {
			tags, err := dal.RetroTagsList(r.Context(), db, retro.ID)
			if err != nil {
				slog.Error("problem fetching tags for retro", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			retro.Tags = tags
		}

		openTasks, err := dal.TagOpenTasks(r.Context(), db, tag)
		if err != nil {
			slog.Error("problem fetching open tasks for tag", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		taskResources := make([]openTaskResource, len(openTasks))
		for i, t := range openTasks {
			taskResources[i] = openTaskResource{
				Task:       *resources.TaskFromModel(&t.Task),
				RetroTitle: t.RetroTitle,
			}
		}

		writeJSON(w, tagRetrosResponse{
			Stats: stats,
			Retros: lo.Map(retros, func(item *model.Retro, _ int) *resources.Retro {
				return resources.RetroFromModel(item)
			}),
			OpenTasks: taskResources,
		})
	})
}
