package gif

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/samber/lo"
)

type TenorProvider struct {
	URL    string
	APIKey string
}

var _ Provider = (*TenorProvider)(nil)

func NewTenorProvider(apiKey string) *TenorProvider {
	return &TenorProvider{
		URL:    "https://tenor.googleapis.com",
		APIKey: apiKey,
	}
}

type (
	tenorMediaFormat struct {
		URL string `json:"url"`
	}

	tenorResult struct {
		ID           string `json:"id"`
		MediaFormats struct {
			MediumGif tenorMediaFormat `json:"mediumgif"`
			Gif       tenorMediaFormat `json:"gif"`
		} `json:"media_formats"`
	}

	tenorSearchResponse struct {
		Results []tenorResult `json:"results"`
	}
)

func (t *TenorProvider) Search(ctx context.Context, query string) ([]SearchResult, error) {
	searchURL, err := url.JoinPath(t.URL, "/v2/search")
	if err != nil {
		return nil, fmt.Errorf("failed to join url path for tenor search: %w", err)
	}

	searchURL += "?" + url.Values{
		"q":     []string{query},
		"key":   []string{t.APIKey},
		"limit": []string{"9"},
	}.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for tenor search: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request for tenor search: %w", err)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tenor search failed with status code %d", resp.StatusCode)
	}

	var searchResp tenorSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode tenor search response: %w", err)
	}

	return lo.Map(searchResp.Results, func(res tenorResult, _ int) SearchResult {
		return SearchResult{
			PreviewURL: res.MediaFormats.MediumGif.URL,
			URL:        res.MediaFormats.Gif.URL,
		}
	}), nil
}
