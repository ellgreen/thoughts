package controllers

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/ellgreen/thoughts/cmd/thoughts/gif"
)

// maxGifQuery is generous enough for a phrase and short enough that nobody can
// use the proxy to smuggle a payload upstream.
const maxGifQuery = 64

func GifSearch(provider gif.Provider) http.Handler {
	if provider == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "gif search is not configured", http.StatusServiceUnavailable)
		})
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if len(query) > maxGifQuery {
			http.Error(w, "search is too long", http.StatusBadRequest)
			return
		}

		page, _ := strconv.Atoi(r.URL.Query().Get("page"))

		var (
			results *gif.SearchPage
			err     error
		)

		if query == "" {
			results, err = provider.Trending(r.Context(), page)
		} else {
			results, err = provider.Search(r.Context(), query, page)
		}

		if err != nil {
			slog.Error("gif search failed", "provider", provider.Name(), "error", err)
			http.Error(w, "could not reach the gif service", http.StatusBadGateway)
			return
		}

		writeJSON(w, results)
	})
}
