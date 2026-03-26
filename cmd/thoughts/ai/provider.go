package ai

import (
	"log/slog"

	"github.com/tmc/langchaingo/llms"
)

type Model llms.Model

// Config holds the configuration for the AI provider.
// Azure OpenAI is preferred when all Azure fields are set; otherwise falls back to OpenAI.
type Config struct {
	OpenAIAPIKey          string
	AzureOpenAIAPIKey     string
	AzureOpenAIEndpoint   string
	AzureOpenAIDeployment string
}

var model Model

func ResolveModel(cfg Config) Model {
	if model != nil {
		return model
	}

	var err error

	if cfg.AzureOpenAIAPIKey != "" && cfg.AzureOpenAIEndpoint != "" && cfg.AzureOpenAIDeployment != "" {
		slog.Info("using azure openai ai provider")

		model, err = newAzureOpenAIModel(cfg.AzureOpenAIAPIKey, cfg.AzureOpenAIEndpoint, cfg.AzureOpenAIDeployment)
		if err != nil {
			slog.Error("failed to create azure openai provider", "err", err)

			return nil
		}
	} else if cfg.OpenAIAPIKey != "" {
		slog.Info("using openai ai provider")

		model, err = newOpenAIModel(cfg.OpenAIAPIKey)
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
