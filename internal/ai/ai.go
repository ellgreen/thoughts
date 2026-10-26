// Package ai turns a retro's notes into suggestions through whichever model
// provider an install has configured.
package ai

import (
	"context"
	"errors"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/openai/openai-go/v3"

	"github.com/ellgreen/thoughts/internal/config"
)

// Request asks for one JSON object matching Schema. Schemas follow the
// strict subset every driver accepts: every property required, no extras.
type Request struct {
	Name   string
	System string
	Prompt string
	Schema map[string]any
}

type Driver interface {
	Name() string
	Complete(ctx context.Context, r Request) ([]byte, error)
}

// ErrDeclined is a provider choosing not to answer, as opposed to failing.
var ErrDeclined = errors.New("the model declined to answer")

// Status is the HTTP status a provider refused a request with, or 0 when it
// failed some other way.
func Status(err error) int {
	if e, ok := errors.AsType[*openai.Error](err); ok {
		return e.StatusCode
	}
	if e, ok := errors.AsType[*anthropic.Error](err); ok {
		return e.StatusCode
	}
	return 0
}

// New returns nil, with no error, when AI is turned off.
func New(cfg config.AI) (Driver, error) {
	switch cfg.Driver {
	case "":
		return nil, nil
	case "anthropic":
		return newAnthropic(cfg), nil
	case "openai":
		return newOpenAI(cfg, "openai", ""), nil
	case "openai-compatible":
		return newOpenAI(cfg, "openai-compatible", cfg.BaseURL), nil
	case "copilot":
		return newCopilot(cfg), nil
	}
	return nil, fmt.Errorf("unknown AI driver %q", cfg.Driver)
}

func object(props map[string]any) map[string]any {
	required := make([]string, 0, len(props))
	for k := range props {
		required = append(required, k)
	}
	return map[string]any{"type": "object", "properties": props, "required": required, "additionalProperties": false}
}

func array(items map[string]any, maxItems int) map[string]any {
	return map[string]any{"type": "array", "items": items, "maxItems": maxItems}
}

func text(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}
