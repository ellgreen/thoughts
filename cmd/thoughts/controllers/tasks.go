package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/ellgreen/thoughts/cmd/thoughts/util"
	"github.com/jmoiron/sqlx"
	"github.com/samber/lo"
)

func TaskIndex(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retroID, err := util.UUIDFromRequest(r, "id")
		if err != nil {
			slog.Error("problem parsing retro id", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		tasks, err := dal.TaskList(r.Context(), db, retroID)
		if err != nil {
			slog.Error("problem fetching tasks", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, lo.Map(tasks, func(task *model.Task, _ int) *resources.Task {
			return resources.TaskFromModel(task)
		}))
	})
}
