package controllers

import (
	"log/slog"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/jmoiron/sqlx"
)

type AuthLoginRequest struct {
	Name string `json:"name" validate:"required,max=32"`
}

func AuthLogin(db *sqlx.DB, sessionProvider *session.Provider) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, ok := requests.From[AuthLoginRequest](w, r)
		if !ok {
			return
		}

		// Names are free text - people have spaces, hyphens and accents in
		// them. Only control characters are worth rejecting.
		name := strings.TrimSpace(req.Name)

		if utf8.RuneCountInString(name) < 2 {
			http.Error(w, "Name should contain at least 2 characters", http.StatusBadRequest)
			return
		}

		if strings.ContainsFunc(name, func(r rune) bool { return !unicode.IsPrint(r) }) {
			http.Error(w, "Name should not contain control characters", http.StatusBadRequest)
			return
		}

		user, err := dal.UserGetOrCreate(r.Context(), db, name)
		if err != nil {
			slog.Error("failed to resolve user", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

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
