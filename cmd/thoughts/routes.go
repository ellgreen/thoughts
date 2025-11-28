package main

import (
	"fmt"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/ai"
	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/controllers"
	"github.com/ellgreen/thoughts/cmd/thoughts/gif"
	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/ellgreen/thoughts/cmd/thoughts/socket"
	"github.com/ellgreen/thoughts/ui"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

const uuidRegex = `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`

func applyRoutes(
	router *mux.Router,
	sessionProvider *session.Provider,
	aiModel ai.Model,
	gifProvider gif.Provider,
) {
	router.Use(handlers.RecoveryHandler())

	apiRouter := router.PathPrefix("/api").Subrouter()

	apiRouter.Handle("/auth/login", controllers.AuthLogin(db, sessionProvider)).Methods(http.MethodPost)

	authRouter := apiRouter.NewRoute().Subrouter()
	authRouter.Use(auth.Middleware(db, sessionProvider))

	authRouter.Handle("/auth/self", controllers.AuthSelf(sessionProvider)).Methods(http.MethodGet)
	authRouter.Handle("/auth/logout", controllers.AuthLogout(sessionProvider)).Methods(http.MethodPost)

	authRouter.Handle("/gifs", controllers.GifSearch(gifProvider)).Methods(http.MethodPost)

	aiRouter := authRouter.PathPrefix("/ai").Subrouter()
	aiRouter.Handle("/retro-template", controllers.AIRetroTemplate(aiModel)).Methods(http.MethodPost)

	retrosRouter := authRouter.PathPrefix("/retros").Subrouter()

	retrosRouter.Handle("", controllers.RetroIndex(db)).Methods(http.MethodGet)
	retrosRouter.Handle("", controllers.RetroCreate(db)).Methods(http.MethodPost)

	retroRouter := retrosRouter.PathPrefix(fmt.Sprintf("/{id:%s}", uuidRegex)).Subrouter()

	retroRouter.Handle("/ws", socket.NewRetroSocketHandler(db))
	retroRouter.Handle("/notes", controllers.RetroNotesIndex(db)).Methods(http.MethodGet)
	retroRouter.Handle("/votes", controllers.VotesIndex(db)).Methods(http.MethodGet)
	retroRouter.Handle("/votes", controllers.Vote(db)).Methods(http.MethodPost)
	retroRouter.Handle("/tasks", controllers.TaskIndex(db)).Methods(http.MethodGet)
	retroRouter.Handle("/markdown", controllers.RetroMarkdown(db)).Methods(http.MethodGet)
	retroRouter.Handle("", controllers.RetroGet(db)).Methods(http.MethodGet)

	router.PathPrefix("/").Handler(ui.HandlerFunc())
}
