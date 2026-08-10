package gif

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
)

// GiphyProvider talks to https://developers.giphy.com. Giphy no longer has a
// free tier, so it is here for anyone who already holds a key rather than as
// the default.
type GiphyProvider struct {
	BaseURL string
	APIKey  string
}

var _ Provider = (*GiphyProvider)(nil)

const giphyBaseURL = "https://api.giphy.com/v1"

func NewGiphyProvider(apiKey string) *GiphyProvider {
	return &GiphyProvider{
		BaseURL: giphyBaseURL,
		APIKey:  apiKey,
	}
}

func (g *GiphyProvider) Name() string {
	return ProviderGiphy
}

func (g *GiphyProvider) Search(ctx context.Context, query string, page int) (*SearchPage, error) {
	return g.fetch(ctx, "gifs/search", url.Values{"q": []string{query}}, page)
}

func (g *GiphyProvider) Trending(ctx context.Context, page int) (*SearchPage, error) {
	return g.fetch(ctx, "gifs/trending", url.Values{}, page)
}

type (
	giphyImage struct {
		URL    string `json:"url"`
		Width  string `json:"width"`
		Height string `json:"height"`
	}

	giphyItem struct {
		ID     string `json:"id"`
		Images struct {
			FixedWidth      giphyImage `json:"fixed_width"`
			DownsizedMedium giphyImage `json:"downsized_medium"`
			Original        giphyImage `json:"original"`
		} `json:"images"`
	}

	giphyResponse struct {
		Data       []giphyItem `json:"data"`
		Pagination struct {
			TotalCount int `json:"total_count"`
			Count      int `json:"count"`
			Offset     int `json:"offset"`
		} `json:"pagination"`
	}
)

func (g *GiphyProvider) fetch(ctx context.Context, path string, params url.Values, page int) (*SearchPage, error) {
	page = normalisePage(page)

	endpoint, err := url.JoinPath(g.BaseURL, path)
	if err != nil {
		return nil, fmt.Errorf("failed to build giphy url: %w", err)
	}

	offset := (page - 1) * perPage

	params.Set("api_key", g.APIKey)
	params.Set("limit", strconv.Itoa(perPage))
	params.Set("offset", strconv.Itoa(offset))
	params.Set("rating", "pg-13")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create giphy request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach giphy: %w", err)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("giphy responded with status %d", resp.StatusCode)
	}

	var body giphyResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("failed to decode giphy response: %w", err)
	}

	results := make([]SearchResult, 0, len(body.Data))

	for _, item := range body.Data {
		if result, ok := item.toResult(); ok {
			results = append(results, result)
		}
	}

	return &SearchPage{
		Results: results,
		Page:    page,
		HasNext: offset+len(body.Data) < body.Pagination.TotalCount,
	}, nil
}

func (i giphyItem) toResult() (SearchResult, bool) {
	full := firstImage(i.Images.DownsizedMedium, i.Images.Original, i.Images.FixedWidth)
	if full.URL == "" {
		return SearchResult{}, false
	}

	preview := firstImage(i.Images.FixedWidth, full)

	// Giphy reports dimensions as strings.
	width, _ := strconv.Atoi(preview.Width)
	height, _ := strconv.Atoi(preview.Height)

	return SearchResult{
		PreviewURL: preview.URL,
		URL:        full.URL,
		Width:      width,
		Height:     height,
	}, true
}

func firstImage(images ...giphyImage) giphyImage {
	for _, image := range images {
		if image.URL != "" {
			return image
		}
	}

	return giphyImage{}
}
