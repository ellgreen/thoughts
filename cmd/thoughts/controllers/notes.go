package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	"github.com/samber/lo"
)

func RetroNotesIndex(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retroID, err := uuid.Parse(mux.Vars(r)["id"])
		if err != nil {
			slog.Error("problem parsing retro id", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		retro, err := dal.RetroGet(r.Context(), db, retroID)
		if err != nil {
			slog.Error("problem fetching retro", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		notes, err := dal.NoteList(r.Context(), db, retroID)
		if err != nil {
			slog.Error("problem fetching notes", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		user := auth.UserFromRequest(r)

		obfuscate := retro.Status == model.RetroStatusBrainstorm

		writeJSON(w, lo.Map(notes, func(note *model.Note, _ int) *resources.Note {
			return resources.NoteFromModel(note, user.ID, obfuscate)
		}))
	})
}
