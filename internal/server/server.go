package server

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/ellgreen/thoughts/internal/ai"
	"github.com/ellgreen/thoughts/internal/auth"
	"github.com/ellgreen/thoughts/internal/config"
	"github.com/ellgreen/thoughts/internal/db"
	"github.com/ellgreen/thoughts/internal/gif"
	"github.com/ellgreen/thoughts/internal/live"
	"github.com/ellgreen/thoughts/internal/store"
	"github.com/ellgreen/thoughts/internal/v1import"
	"github.com/ellgreen/thoughts/internal/web"
	"github.com/ellgreen/thoughts/migrations"
)

type app struct {
	version   string
	store     *store.Store
	providers []auth.Provider
	hubs      *live.Hubs
	// gifs is nil when GIF search is off; pasting a link still works.
	gifs gif.Provider
	// ai is nil when no AI driver is configured.
	ai     ai.Driver
	aiBusy sync.Map
	// v1 recognises cookies v1 issued, and is nil on an install that never
	// ran v1.
	v1 *v1import.Sessions
	// closing closes when the server starts shutting down; sockets counts
	// the work it waits for before the database closes.
	closing chan struct{}
	sockets sync.WaitGroup
	// tls is whether this process terminates TLS itself, which makes every
	// cookie Secure regardless of what the request says.
	tls bool
}

func Run(ctx context.Context, cfg config.Config, version string) error {
	d, err := db.Open(cfg.DatabasePath())
	if err != nil {
		return err
	}
	defer func() { _ = d.Close() }()
	if err := importV1(ctx, d, cfg.DatabasePath()); err != nil {
		return err
	}
	if err := db.Migrate(ctx, d, migrations.FS); err != nil {
		return err
	}
	v1, err := v1import.LoadSessions(cfg.SessionKeyPath())
	if err != nil {
		return fmt.Errorf("reading v1's session key: %w", err)
	}
	providers, err := auth.New(cfg)
	if err != nil {
		return err
	}
	gifs, err := gif.Resolve(cfg.GIFProvider, cfg.GIFAPIKey)
	if err != nil {
		return err
	}
	model, err := ai.New(cfg.AI)
	if err != nil {
		return err
	}
	if model != nil {
		slog.Info("ai suggestions on", "driver", model.Name())
	}
	closing := make(chan struct{})
	a := &app{version: version, store: store.New(d), providers: providers, hubs: live.NewHubs(), gifs: gifs, ai: model, v1: v1, tls: cfg.TLS(), closing: closing}

	srv := &http.Server{
		Addr:              cfg.Address,
		Handler:           a.handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	srv.RegisterOnShutdown(func() { close(closing) })
	errs := make(chan error, 1)
	go func() {
		slog.Info("listening", "address", cfg.Address, "version", version, "ui", web.Bundled(), "db", cfg.DatabasePath(), "auth", cfg.Auth)
		if cfg.TLS() {
			errs <- srv.ListenAndServeTLS(cfg.TLSCertPath, cfg.TLSKeyPath)
		} else {
			errs <- srv.ListenAndServe()
		}
	}()

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	err = srv.Shutdown(shutdown)
	sockets := make(chan struct{})
	go func() {
		a.sockets.Wait()
		close(sockets)
	}()
	select {
	case <-sockets:
	case <-shutdown.Done():
	}
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// importV1 converts a v1 database in place on first start, after copying it.
func importV1(ctx context.Context, d *sql.DB, path string) error {
	isV1, err := db.IsV1(ctx, d)
	if err != nil || !isV1 {
		return err
	}
	slog.Info("found a thoughts v1 database; copying it, then converting it to v2", "db", path)
	backup, err := v1import.Backup(ctx, d, path, time.Now())
	if err != nil {
		return err
	}
	sum, err := v1import.Import(ctx, d, migrations.FS)
	if err != nil {
		return fmt.Errorf("converting the v1 database failed and nothing in it was changed; the copy taken first is %s: %w", backup, err)
	}
	slog.Info("converted the v1 database", "imported", sum.String(), "backup", backup)
	return nil
}

func (a *app) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("GET /api/auth/providers", a.listProviders)
	mux.HandleFunc("POST /api/auth/{provider}", a.signIn)
	mux.HandleFunc("GET /api/auth/{provider}/start", a.startRedirect)
	mux.HandleFunc("GET /api/auth/{provider}/callback", a.finishRedirect)
	mux.HandleFunc("POST /api/auth/signout", a.signOut)
	mux.Handle("GET /api/me", a.requireUser(a.me))

	mux.Handle("GET /api/retros", a.requireUser(a.listRetros))
	mux.Handle("POST /api/retros", a.requireUser(a.createRetro))
	mux.Handle("GET /api/retros/{id}", a.requireUser(a.getRetro))
	mux.Handle("GET /api/retros/{id}/socket", a.requireUser(a.socket))
	mux.Handle("GET /api/retros/{id}/export.md", a.requireUser(a.exportRetro))
	mux.Handle("GET /api/tags", a.requireUser(a.listTags))
	mux.Handle("GET /api/tags/{tag}", a.requireUser(a.tag))
	mux.Handle("GET /api/teams", a.requireUser(a.listTeams))
	mux.Handle("POST /api/teams", a.requireUser(a.createTeam))
	mux.Handle("GET /api/teams/{slug}", a.requireUser(a.team))
	mux.Handle("GET /api/gifs", a.requireUser(a.searchGIFs))
	mux.Handle("POST /api/ai/template", a.requireUser(a.aiTemplate))

	mux.Handle("/api/", http.NotFoundHandler())
	mux.Handle("/", web.Handler())

	return recoverer(logRequests(http.NewCrossOriginProtection().Handler(mux)))
}

func (a *app) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": a.version})
}
