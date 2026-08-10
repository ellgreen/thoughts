package gif

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

const klipyBody = `{
  "result": true,
  "data": {
    "data": [
      {
        "slug": "dancing-cat",
        "files": {
          "gif":  {"hd": {"url": "https://cdn.example/hd.gif", "width": 480, "height": 360},
                   "md": {"url": "https://cdn.example/md.gif", "width": 360, "height": 270},
                   "sm": {"url": "https://cdn.example/sm.gif", "width": 240, "height": 180}},
          "webp": {"sm": {"url": "https://cdn.example/sm.webp", "width": 240, "height": 180}}
        }
      },
      {
        "slug": "an-advert",
        "files": {}
      },
      {
        "slug": "no-webp",
        "files": {
          "gif": {"sm": {"url": "https://cdn.example/only-sm.gif", "width": 100, "height": 100}}
        }
      }
    ],
    "current_page": 2,
    "per_page": 24,
    "has_next": true
  }
}`

func TestKlipySearchMapsResults(t *testing.T) {
	var gotPath string
	var gotQuery url.Values

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.Query()

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(klipyBody))
	}))
	defer server.Close()

	provider := &KlipyProvider{BaseURL: server.URL, APIKey: "test-key"}

	page, err := provider.Search(context.Background(), "dancing cat", 2)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	// The key travels in the path, not a header or query parameter.
	if gotPath != "/test-key/gifs/search" {
		t.Errorf("requested %q, want /test-key/gifs/search", gotPath)
	}

	if gotQuery.Get("q") != "dancing cat" {
		t.Errorf("q = %q, want %q", gotQuery.Get("q"), "dancing cat")
	}

	if gotQuery.Get("page") != "2" {
		t.Errorf("page = %q, want 2", gotQuery.Get("page"))
	}

	if gotQuery.Get("per_page") != "24" {
		t.Errorf("per_page = %q, want 24", gotQuery.Get("per_page"))
	}

	// The advert with no files is skipped.
	if len(page.Results) != 2 {
		t.Fatalf("got %d results, want 2", len(page.Results))
	}

	first := page.Results[0]

	if first.URL != "https://cdn.example/md.gif" {
		t.Errorf("URL = %q, want the medium gif", first.URL)
	}

	if first.PreviewURL != "https://cdn.example/sm.webp" {
		t.Errorf("PreviewURL = %q, want the small webp", first.PreviewURL)
	}

	if first.Width != 240 || first.Height != 180 {
		t.Errorf("preview dimensions = %dx%d, want 240x180", first.Width, first.Height)
	}

	// Falls back through the sizes when a variant is missing.
	second := page.Results[1]

	if second.URL != "https://cdn.example/only-sm.gif" || second.PreviewURL != "https://cdn.example/only-sm.gif" {
		t.Errorf("fallback mapping produced %+v", second)
	}

	if !page.HasNext || page.Page != 2 {
		t.Errorf("pagination = page %d hasNext %v, want page 2 hasNext true", page.Page, page.HasNext)
	}
}

func TestKlipyTrendingUsesTheTrendingEndpoint(t *testing.T) {
	var gotPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_, _ = w.Write([]byte(klipyBody))
	}))
	defer server.Close()

	provider := &KlipyProvider{BaseURL: server.URL, APIKey: "k"}

	if _, err := provider.Trending(context.Background(), 0); err != nil {
		t.Fatalf("trending failed: %v", err)
	}

	if gotPath != "/k/gifs/trending" {
		t.Errorf("requested %q, want /k/gifs/trending", gotPath)
	}
}

func TestKlipySurfacesUpstreamFailures(t *testing.T) {
	cases := map[string]http.HandlerFunc{
		"http error": func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
		},
		"unparseable body": func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("not json"))
		},
		"result false": func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(`{"result": false, "data": {}}`))
		},
	}

	for name, handler := range cases {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(handler)
			defer server.Close()

			provider := &KlipyProvider{BaseURL: server.URL, APIKey: "k"}

			if _, err := provider.Search(context.Background(), "cat", 1); err == nil {
				t.Error("expected an error to be surfaced")
			}
		})
	}
}

func TestGiphySearchMapsResults(t *testing.T) {
	var gotQuery url.Values

	body, _ := json.Marshal(map[string]any{
		"data": []map[string]any{
			{
				"id": "abc",
				"images": map[string]any{
					"fixed_width":      map[string]any{"url": "https://cdn.giphy/fw.gif", "width": "200", "height": "150"},
					"downsized_medium": map[string]any{"url": "https://cdn.giphy/dm.gif"},
					"original":         map[string]any{"url": "https://cdn.giphy/orig.gif"},
				},
			},
			{"id": "no-images", "images": map[string]any{}},
		},
		"pagination": map[string]any{"total_count": 100, "count": 2, "offset": 24},
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		_, _ = w.Write(body)
	}))
	defer server.Close()

	provider := &GiphyProvider{BaseURL: server.URL, APIKey: "giphy-key"}

	page, err := provider.Search(context.Background(), "cat", 2)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	if gotQuery.Get("api_key") != "giphy-key" {
		t.Errorf("api_key = %q", gotQuery.Get("api_key"))
	}

	// Giphy paginates by offset rather than page number.
	if gotQuery.Get("offset") != "24" {
		t.Errorf("offset = %q, want 24", gotQuery.Get("offset"))
	}

	if len(page.Results) != 1 {
		t.Fatalf("got %d results, want 1", len(page.Results))
	}

	got := page.Results[0]

	if got.URL != "https://cdn.giphy/dm.gif" || got.PreviewURL != "https://cdn.giphy/fw.gif" {
		t.Errorf("mapping produced %+v", got)
	}

	if got.Width != 200 || got.Height != 150 {
		t.Errorf("dimensions = %dx%d, want 200x150", got.Width, got.Height)
	}

	if !page.HasNext {
		t.Error("expected more pages given 100 total results")
	}
}

func TestResolve(t *testing.T) {
	cases := []struct {
		name        string
		provider    string
		apiKey      string
		wantName    string
		wantNil     bool
		wantErrPart string
	}{
		{name: "auto with a key picks klipy", apiKey: "k", wantName: ProviderKlipy},
		{name: "auto without a key disables search", wantNil: true},
		{name: "explicit none", provider: ProviderNone, apiKey: "k", wantNil: true},
		{name: "explicit klipy", provider: ProviderKlipy, apiKey: "k", wantName: ProviderKlipy},
		{name: "explicit giphy", provider: ProviderGiphy, apiKey: "k", wantName: ProviderGiphy},
		{name: "klipy without a key", provider: ProviderKlipy, wantErrPart: "THOUGHTS_GIF_API_KEY"},
		{name: "unknown provider", provider: "tenor", apiKey: "k", wantErrPart: "unknown gif provider"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			provider, err := Resolve(tc.provider, tc.apiKey)

			if tc.wantErrPart != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErrPart) {
					t.Fatalf("expected an error containing %q, got %v", tc.wantErrPart, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.wantNil {
				if provider != nil {
					t.Errorf("expected search to be disabled, got %s", provider.Name())
				}

				if SearchAvailable() {
					t.Error("SearchAvailable should be false with no provider")
				}

				return
			}

			if provider == nil {
				t.Fatal("expected a provider")
			}

			if provider.Name() != tc.wantName {
				t.Errorf("provider = %s, want %s", provider.Name(), tc.wantName)
			}

			if !SearchAvailable() {
				t.Error("SearchAvailable should be true with a provider")
			}
		})
	}
}
