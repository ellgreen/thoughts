package logging

import (
	"fmt"
	"io"
	"log/slog"
)

type Format string

const (
	Text Format = "text"
	JSON Format = "json"
)

func ParseFormat(s string) (Format, error) {
	switch f := Format(s); f {
	case Text, JSON:
		return f, nil
	}
	return "", fmt.Errorf("%q is not a log format; use text or json", s)
}

func New(w io.Writer, f Format, level slog.Level) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level}
	if f == JSON {
		return slog.New(slog.NewJSONHandler(w, opts))
	}
	return slog.New(slog.NewTextHandler(w, opts))
}
