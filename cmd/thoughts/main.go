package main

import (
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
	cfg *config
	db  *sqlx.DB
)

func main() {
	var err error
	cfg, err = loadConfig()
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	slogLevel := slog.LevelInfo
	if cfg.Verbose {
		slogLevel = slog.LevelDebug
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slogLevel,
	})))

	if err := initialiseDatabase(); err != nil {
		slog.Error("database initialisation failed", "err", err)
		os.Exit(1)
	}

	sessionKeyPath := filepath.Join(cfg.DataPath, cfg.SessionKeyFile)
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
			AllowedOrigins:   []string{cfg.UIAddress},
			AllowCredentials: true,
		})
	}

	handler := corsCfg.Handler(router)

	if cfg.TLSCertPath != "" && cfg.TLSKeyPath != "" {
		slog.Info("starting server (with tls)", "addr", cfg.Address)

		if err := http.ListenAndServeTLS(cfg.Address, cfg.TLSCertPath, cfg.TLSKeyPath, handler); err != nil {
			slog.Error("failed to start server", "err", err)
			os.Exit(1)
		}

		return
	}

	slog.Info("starting server (no tls)", "addr", cfg.Address)

	if err := http.ListenAndServe(cfg.Address, handler); err != nil {
		slog.Error("failed to start server", "err", err)
		os.Exit(1)
	}
}

func initialiseDatabase() error {
	databasePath := filepath.Join(cfg.DataPath, cfg.DatabaseFile)
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
