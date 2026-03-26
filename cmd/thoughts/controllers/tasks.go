package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	"github.com/samber/lo"
)

func TaskIndex(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retroID, err := uuid.Parse(mux.Vars(r)["id"])
		if err != nil {
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

type taskCompleteRequest struct {
	Completed bool `json:"completed"`
}

func TaskComplete(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		taskID, err := uuid.Parse(mux.Vars(r)["taskId"])
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		req, ok := requests.From[taskCompleteRequest](w, r)
		if !ok {
			return
		}

		task, err := dal.TaskUpdateComplete(r.Context(), db, taskID, req.Completed)
		if err != nil {
			slog.Error("problem updating task completion", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, resources.TaskFromModel(task))
	})
}
