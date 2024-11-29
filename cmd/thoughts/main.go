package main

import (
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/ellgreen/thoughts/migrations"
	"github.com/ellgreen/thoughts/ui"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	"github.com/pressly/goose/v3"
	"github.com/rs/cors"
	_ "modernc.org/sqlite"
)

var (
	addr    = flag.String("addr", "localhost:3000", "Address to listen on")
	verbose = flag.Bool("v", false, "Log level")
	uiURL   = flag.String("ui-url", "http://localhost:5173", "UI URL - only available in development")

	dataPath       = flag.String("data", "./data", "Path to the data directory")
	databaseFile   = flag.String("database", "thoughts.sqlite", "The database file name")
	sessionKeyFile = flag.String("session-key", "session.key", "The session key file name")

	db *sqlx.DB
)

func main() {
	flag.Parse()

	slogLevel := slog.LevelInfo
	if *verbose {
		slogLevel = slog.LevelDebug
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slogLevel,
	})))

	if err := initialiseDatabase(); err != nil {
		slog.Error("database initialisation failed", "err", err)
		os.Exit(1)
	}

	sessionKeyPath := filepath.Join(*dataPath, *sessionKeyFile)
	sessionProvider, err := session.LoadSessionProvider(sessionKeyPath)
	if err != nil {
		slog.Error("failed to load session provider", "err", err)
		os.Exit(1)
	}

	router := mux.NewRouter()

	applyRoutes(router, sessionProvider)

	corsCfg := cors.Default()
	if !ui.IsBundled() {
		corsCfg = cors.New(cors.Options{
			AllowedOrigins:   []string{*uiURL},
			AllowCredentials: true,
		})
	}

	handler := corsCfg.Handler(router)

	slog.Info("starting server", "addr", *addr)

	if err := http.ListenAndServe(*addr, handler); err != nil {
		slog.Error("failed to start server", "err", err)
		os.Exit(1)
	}
}

func initialiseDatabase() error {
	databasePath := filepath.Join(*dataPath, *databaseFile)
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL", databasePath)

	var err error
	db, err = sqlx.Open("sqlite", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	goose.SetBaseFS(migrations.Embedded)

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("failed to set dialect: %w", err)
	}

	if err := goose.Up(db.DB, "."); err != nil {
		return fmt.Errorf("failed migrate database: %w", err)
	}

	return nil
}
