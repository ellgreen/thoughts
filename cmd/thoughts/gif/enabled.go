package gif

import "log/slog"

var provider Provider

func ResolveProvider(tenorAPIKey string) Provider {
	if provider != nil {
		return provider
	}

	if tenorAPIKey != "" {
		slog.Info("using tenor gif provider")

		provider = NewTenorProvider(tenorAPIKey)
	}

	return provider
}

func IsAvailable() bool {
	return provider != nil
}
