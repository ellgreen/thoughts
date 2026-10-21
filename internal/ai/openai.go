package ai

import (
	"cmp"
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/shared"

	"github.com/ellgreen/thoughts/internal/config"
)

// openAIDriver also serves any OpenAI-compatible server (Ollama, vLLM,
// LiteLLM) through BaseURL.
type openAIDriver struct {
	client openai.Client
	model  string
	name   string
}

func newOpenAI(cfg config.AI, name, baseURL string) *openAIDriver {
	opts := []option.RequestOption{option.WithAPIKey(cmp.Or(cfg.APIKey, "unused"))}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}
	return &openAIDriver{client: openai.NewClient(opts...), model: cmp.Or(cfg.Model, "gpt-5-mini"), name: name}
}

func (d *openAIDriver) Name() string { return d.name }

func (d *openAIDriver) Complete(ctx context.Context, r Request) ([]byte, error) {
	res, err := d.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: d.model,
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(r.System),
			openai.UserMessage(r.Prompt),
		},
		ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
			OfJSONSchema: &shared.ResponseFormatJSONSchemaParam{
				JSONSchema: shared.ResponseFormatJSONSchemaJSONSchemaParam{Name: r.Name, Schema: r.Schema, Strict: openai.Bool(true)},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("%s %s: %w", d.name, r.Name, err)
	}
	if len(res.Choices) == 0 {
		return nil, fmt.Errorf("%s %s: no choices in the response", d.name, r.Name)
	}
	choice := res.Choices[0]
	if choice.Message.Refusal != "" {
		return nil, ErrDeclined
	}
	if choice.FinishReason == "length" {
		return nil, fmt.Errorf("%s %s: the answer was cut off", d.name, r.Name)
	}
	return []byte(choice.Message.Content), nil
}
