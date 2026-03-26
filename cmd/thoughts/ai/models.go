package ai

import (
	"github.com/tmc/langchaingo/llms/openai"
)

func newOpenAIModel(apiKey string) (Model, error) {
	model, err := openai.New(
		openai.WithToken(apiKey),
		openai.WithModel("gpt-4o-mini"),
	)
	if err != nil {
		return nil, err
	}

	return model, nil
}

func newAzureOpenAIModel(apiKey, endpoint, deployment string) (Model, error) {
	model, err := openai.New(
		openai.WithToken(apiKey),
		openai.WithModel(deployment),
		openai.WithAPIType(openai.APITypeAzure),
		openai.WithBaseURL(endpoint),
	)
	if err != nil {
		return nil, err
	}

	return model, nil
}
