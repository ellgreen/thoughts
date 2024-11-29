package auth

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
)

type userCtxKey struct{}

func Middleware(db *sqlx.DB, sp *session.Provider) mux.MiddlewareFunc {
	return mux.MiddlewareFunc(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := sp.GetUserID(w, r)
			if err != nil {
				if !errors.Is(err, session.ErrValueNotFound) {
					slog.Error("failed to get user id from session", "error", err)
					w.WriteHeader(http.StatusInternalServerError)
					return
				}

				w.WriteHeader(http.StatusUnauthorized)
				return
			}

			user, err := dal.UserGet(r.Context(), db, userID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}

				slog.Error("failed to get user", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
			}

			r = RequestWithUser(r, user)

			next.ServeHTTP(w, r)
		})
	})
}

func RequestWithUser(r *http.Request, user *model.User) *http.Request {
	ctx := r.Context()

	return r.WithContext(context.WithValue(ctx, userCtxKey{}, user))
}

func UserFromRequest(r *http.Request) *model.User {
	ctx := r.Context()

	user, ok := ctx.Value(userCtxKey{}).(*model.User)
	if !ok {
		panic("user not found in request context")
	}

	return user
}
