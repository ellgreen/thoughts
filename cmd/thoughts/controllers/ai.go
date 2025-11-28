package controllers

import (
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/ai"
	"github.com/ellgreen/thoughts/cmd/thoughts/ai/prompts"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
)

type PromptRequest struct {
	Prompt string `json:"prompt" validate:"required,min=2,max=32"`
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

		resp, err := prompts.GenerateRetroTemplate(r.Context(), aiModel, req.Prompt)
		if err != nil {
			slog.Error("failed to generate retro template", "err", err)
			http.Error(w, "failed to generate retro template", http.StatusInternalServerError)
			return
		}

		writeJSON(w, resp)
	})
}
