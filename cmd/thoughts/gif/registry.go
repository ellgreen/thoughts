package gif

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Provider names accepted by THOUGHTS_GIF_PROVIDER.
const (
	ProviderKlipy = "klipy"
	ProviderGiphy = "giphy"
	ProviderNone  = "none"
)

// http.DefaultClient has no timeout, so a hung provider would pin a goroutine.
var httpClient = &http.Client{Timeout: 8 * time.Second}

// Whether the search tab is worth showing. Pasting a link never needs one.
var searchAvailable bool

// SearchAvailable reports whether GIF search is configured.
func SearchAvailable() bool {
	return searchAvailable
}

// Resolve builds the configured search provider. Nil is a supported outcome:
// the picker still lets people paste a link.
func Resolve(name, apiKey string) (Provider, error) {
	provider, err := build(name, apiKey)
	if err != nil {
		return nil, err
	}

	searchAvailable = provider != nil

	if provider == nil {
		slog.Info("gif search disabled, paste a link instead")
	} else {
		slog.Info("gif search enabled", "provider", provider.Name())
	}

	return provider, nil
}

func build(name, apiKey string) (Provider, error) {
	switch name {
	case ProviderNone:
		return nil, nil

	case "":
		if apiKey == "" {
			return nil, nil
		}

		return NewKlipyProvider(apiKey), nil

	case ProviderKlipy:
		if apiKey == "" {
			return nil, fmt.Errorf("gif provider %q needs THOUGHTS_GIF_API_KEY", name)
		}

		return NewKlipyProvider(apiKey), nil

	case ProviderGiphy:
		if apiKey == "" {
			return nil, fmt.Errorf("gif provider %q needs THOUGHTS_GIF_API_KEY", name)
		}

		return NewGiphyProvider(apiKey), nil

	default:
		return nil, fmt.Errorf("unknown gif provider %q, expected one of %q, %q or %q",
			name, ProviderKlipy, ProviderGiphy, ProviderNone)
	}
}
