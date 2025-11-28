package ai

import (
	"log/slog"

	"github.com/tmc/langchaingo/llms"
)

type Model llms.Model

var model Model

func ResolveModel(openaiAPIKey string) Model {
	if model != nil {
		return model
	}

	if openaiAPIKey != "" {
		slog.Info("using openai ai provider")

		var err error
		model, err = newOpenAIModel(openaiAPIKey)
		if err != nil {
			slog.Error("failed to create openai provider", "err", err)

			return nil
		}
	}

	return model
}

func IsAvailable() bool {
	return model != nil
}
