package controllers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/ai"
	"github.com/ellgreen/thoughts/cmd/thoughts/ai/prompts"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
)

const generateTimeout = 30 * time.Second

type PromptRequest struct {
	Prompt string `json:"prompt" validate:"required,min=2,max=128"`
}

func AIRetroTemplate(aiModel ai.Model) http.Handler {
	if aiModel == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "ai not available", http.StatusServiceUnavailable)
		})
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, ok := requests.From[PromptRequest](w, r)
		if !ok {
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), generateTimeout)
		defer cancel()

		resp, err := prompts.GenerateRetroTemplate(ctx, aiModel, req.Prompt)
		if err != nil {
			slog.Error("failed to generate retro template", "err", err)
			http.Error(w, "failed to generate retro template", http.StatusInternalServerError)
			return
		}

		writeJSON(w, resp)
	})
}
