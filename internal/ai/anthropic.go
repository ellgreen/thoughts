package ai

import (
	"cmp"
	"context"
	"errors"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/anthropics/anthropic-sdk-go/shared/constant"

	"github.com/ellgreen/thoughts/internal/config"
)

type anthropicDriver struct {
	client anthropic.Client
	model  string
}

func newAnthropic(cfg config.AI) *anthropicDriver {
	return &anthropicDriver{
		client: anthropic.NewClient(option.WithAPIKey(cfg.APIKey)),
		model:  cmp.Or(cfg.Model, "claude-opus-5-5"),
	}
}

func (d *anthropicDriver) Name() string { return "anthropic" }

// Complete uses structured outputs so the reply is always schema-valid JSON.
// Server-side fallbacks let a refused request be re-served by another model
// in the same call rather than failing.
func (d *anthropicDriver) Complete(ctx context.Context, r Request) ([]byte, error) {
	msg, err := d.client.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     anthropic.Model(d.model),
		MaxTokens: 16000,
		System:    []anthropic.BetaTextBlockParam{{Text: r.System}},
		Messages:  []anthropic.BetaMessageParam{anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(r.Prompt))},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortMedium,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: r.Schema},
		},
		Fallbacks: anthropic.BetaFallbacksParamUnion{OfDefault: constant.ValueOf[constant.Default]()},
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
	})
	if err != nil {
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) {
			return nil, fmt.Errorf("anthropic %s: %d %w", r.Name, apiErr.StatusCode, err)
		}
		return nil, fmt.Errorf("anthropic %s: %w", r.Name, err)
	}
	switch msg.StopReason {
	case anthropic.BetaStopReasonRefusal:
		return nil, ErrDeclined
	case anthropic.BetaStopReasonMaxTokens:
		return nil, fmt.Errorf("anthropic %s: the answer was cut off", r.Name)
	}
	for _, block := range msg.Content {
		if t, ok := block.AsAny().(anthropic.BetaTextBlock); ok {
			return []byte(t.Text), nil
		}
	}
	return nil, fmt.Errorf("anthropic %s: no text in the response", r.Name)
}
