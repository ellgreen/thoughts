package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/jmoiron/sqlx"
)

type AuthLoginRequest struct {
	Name string `json:"name" validate:"required,alpha,min=2,max=20"`
}

func AuthLogin(db *sqlx.DB, sessionProvider *session.Provider) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, ok := requests.From[AuthLoginRequest](w, r)
		if !ok {
			return
		}

		if len(req.Name) < 1 {
			http.Error(w, "name should be more than one character", http.StatusBadRequest)
			return
		}

		user, err := dal.UserInsert(r.Context(), db, req.Name)
		if err != nil {
			slog.Error("failed to insert user", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		slog.Info("user created", "user_id", user.ID, "name", user.Name)

		if err := sessionProvider.AddUserID(w, r, user.ID); err != nil {
			slog.Error("failed to add user id to session", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, resources.UserFromModel(user))
	})
}

func AuthSelf(sessionProvider *session.Provider) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := auth.UserFromRequest(r)

		writeJSON(w, resources.UserFromModel(user))
	})
}

func AuthLogout(sessionProvider *session.Provider) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := sessionProvider.ForgetUserID(w, r); err != nil {
			slog.Error("failed to remove user id from session", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
	})
}
