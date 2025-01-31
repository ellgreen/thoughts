package gif

import "context"

type SearchResult struct {
	PreviewURL string `json:"preview_url"`
	URL        string `json:"url"`
}

type Provider interface {
	Search(ctx context.Context, query string) ([]SearchResult, error)
}
