// Package gif provides GIF search behind a swappable provider. Google shut the
// Tenor API down on 2026-06-30, so the backend is now configurable rather than
// hard-wired to one vendor.
package gif

import "context"

// SearchResult is a single GIF: a preview for the grid and the full URL that
// gets stored on the note.
type SearchResult struct {
	PreviewURL string `json:"preview_url"`
	URL        string `json:"url"`
	// Of the preview, so the picker can reserve space before it loads.
	Width  int `json:"width,omitempty"`
	Height int `json:"height,omitempty"`
}

// SearchPage is one page of results.
type SearchPage struct {
	Results []SearchResult `json:"results"`
	Page    int            `json:"page"`
	HasNext bool           `json:"has_next"`
}

// Provider is a GIF search backend.
type Provider interface {
	Name() string

	// Pages are 1 based.
	Search(ctx context.Context, query string, page int) (*SearchPage, error)

	// Gives the picker something to show before anyone types.
	Trending(ctx context.Context, page int) (*SearchPage, error)
}

// A full grid, without stalling a slow connection on one request.
const perPage = 24

func normalisePage(page int) int {
	if page < 1 {
		return 1
	}

	return page
}
