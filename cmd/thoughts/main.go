package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/ellgreen/thoughts/internal/config"
	"github.com/ellgreen/thoughts/internal/logging"
	"github.com/ellgreen/thoughts/internal/server"
)

var version = "dev"

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	level := slog.LevelInfo
	if cfg.Verbose {
		level = slog.LevelDebug
	}
	slog.SetDefault(logging.New(os.Stdout, cfg.LogFormat, level))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := server.Run(ctx, cfg, version); err != nil {
		slog.Error("exiting", "err", err)
		os.Exit(1)
	}
}
