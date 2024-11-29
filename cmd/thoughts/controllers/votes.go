package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/ellgreen/thoughts/cmd/thoughts/util"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func VotesIndex(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retroID, err := util.UUIDFromRequest(r, "id")
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

		if retro.Status == model.RetroStatusDiscuss {
			// Return all votes

			votes, err := dal.VotesForRetro(r.Context(), db, retroID)
			if err != nil {
				slog.Error("problem fetching votes for retro", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			writeJSON(w, resources.VotesWithCountFromModel(votes))

			return
		}

		// Return user votes

		user := auth.UserFromRequest(r)

		votes, err := dal.VotesForUser(r.Context(), db, retroID, user.ID)
		if err != nil {
			slog.Error("problem fetching votes for user", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, resources.VotesFromModel(votes))
	})
}

type VoteRequest struct {
	GroupID uuid.UUID `json:"group_id" validate:"required,uuid"`
	Value   bool      `json:"value"`
}

func Vote(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retroID, err := util.UUIDFromRequest(r, "id")
		if err != nil {
			slog.Error("problem parsing retro id", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		user := auth.UserFromRequest(r)

		req, ok := requests.From[VoteRequest](w, r)
		if !ok {
			return
		}

		if req.Value {
			if _, err := dal.VoteInsert(r.Context(), db, retroID, user.ID, req.GroupID); err != nil {
				slog.Error("problem inserting vote", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		} else {
			if err := dal.VoteDelete(r.Context(), db, retroID, user.ID, req.GroupID); err != nil {
				slog.Error("problem deleting vote", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		}

		votes, err := dal.VotesForUser(r.Context(), db, retroID, user.ID)
		if err != nil {
			slog.Error("problem fetching votes for user", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, resources.VotesFromModel(votes))
	})
}
