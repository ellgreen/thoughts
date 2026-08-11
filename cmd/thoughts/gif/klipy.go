package gif

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
)

type KlipyProvider struct {
	BaseURL string
	APIKey  string
}

var _ Provider = (*KlipyProvider)(nil)

const klipyBaseURL = "https://api.klipy.com/api/v1"

func NewKlipyProvider(apiKey string) *KlipyProvider {
	return &KlipyProvider{
		BaseURL: klipyBaseURL,
		APIKey:  apiKey,
	}
}

func (k *KlipyProvider) Name() string {
	return ProviderKlipy
}

func (k *KlipyProvider) Search(ctx context.Context, query string, page int) (*SearchPage, error) {
	return k.fetch(ctx, "gifs/search", url.Values{"q": []string{query}}, page)
}

func (k *KlipyProvider) Trending(ctx context.Context, page int) (*SearchPage, error) {
	return k.fetch(ctx, "gifs/trending", url.Values{}, page)
}

type (
	klipyFile struct {
		URL    string `json:"url"`
		Width  int    `json:"width"`
		Height int    `json:"height"`
	}

	// Size first, then format, under "file" rather than "files".
	klipyFormats struct {
		Gif  klipyFile `json:"gif"`
		Webp klipyFile `json:"webp"`
	}

	klipyItem struct {
		Slug string `json:"slug"`
		Type string `json:"type"`
		File struct {
			HD klipyFormats `json:"hd"`
			MD klipyFormats `json:"md"`
			SM klipyFormats `json:"sm"`
			XS klipyFormats `json:"xs"`
		} `json:"file"`
	}

	klipyResponse struct {
		Result bool `json:"result"`
		Data   struct {
			Data        []klipyItem `json:"data"`
			CurrentPage int         `json:"current_page"`
			HasNext     bool        `json:"has_next"`
		} `json:"data"`
	}
)

func (k *KlipyProvider) fetch(ctx context.Context, path string, params url.Values, page int) (*SearchPage, error) {
	page = normalisePage(page)

	endpoint, err := url.JoinPath(k.BaseURL, k.APIKey, path)
	if err != nil {
		return nil, fmt.Errorf("failed to build klipy url: %w", err)
	}

	params.Set("per_page", strconv.Itoa(perPage))
	params.Set("page", strconv.Itoa(page))
	params.Set("rating", "pg-13")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create klipy request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach klipy: %w", err)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("klipy responded with status %d", resp.StatusCode)
	}

	var body klipyResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("failed to decode klipy response: %w", err)
	}

	if !body.Result {
		return nil, fmt.Errorf("klipy reported a failed request")
	}

	results := make([]SearchResult, 0, len(body.Data.Data))

	for _, item := range body.Data.Data {
		if result, ok := item.toResult(); ok {
			results = append(results, result)
		}
	}

	return &SearchPage{
		Results: results,
		Page:    page,
		HasNext: body.Data.HasNext,
	}, nil
}

func (i klipyItem) toResult() (SearchResult, bool) {
	full := firstFile(i.File.MD.Gif, i.File.HD.Gif, i.File.SM.Gif)
	if full.URL == "" {
		return SearchResult{}, false
	}

	preview := firstFile(i.File.SM.Webp, i.File.XS.Webp, i.File.SM.Gif, full)

	return SearchResult{
		PreviewURL: preview.URL,
		URL:        full.URL,
		Width:      preview.Width,
		Height:     preview.Height,
	}, true
}

func firstFile(files ...klipyFile) klipyFile {
	for _, file := range files {
		if file.URL != "" {
			return file
		}
	}

	return klipyFile{}
}
