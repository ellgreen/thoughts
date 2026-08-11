// Package gif provides GIF search behind a swappable provider. Google shut the
// Tenor API down on 2026-06-30, so the backend is now configurable rather than
// hard-wired to one vendor.
package gif

import "context"

type SearchResult struct {
	PreviewURL string `json:"preview_url"`
	URL        string `json:"url"`
	Width      int    `json:"width,omitempty"`
	Height     int    `json:"height,omitempty"`
}

type SearchPage struct {
	Results []SearchResult `json:"results"`
	Page    int            `json:"page"`
	HasNext bool           `json:"has_next"`
}

type Provider interface {
	Name() string
	Search(ctx context.Context, query string, page int) (*SearchPage, error)
	Trending(ctx context.Context, page int) (*SearchPage, error)
}

const perPage = 24

func normalisePage(page int) int {
	if page < 1 {
		return 1
	}

	return page
}
