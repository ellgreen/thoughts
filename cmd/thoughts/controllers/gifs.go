package controllers

import (
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/gif"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
)

type GifSearchRequest struct {
	Query string `json:"q" validate:"required,min=2,max=32"`
}

func GifSearch(gifProvider gif.Provider) http.Handler {
	if gifProvider == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "gifs not available", http.StatusServiceUnavailable)
		})
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, ok := requests.From[GifSearchRequest](w, r)
		if !ok {
			return
		}

		results, err := gifProvider.Search(r.Context(), req.Query)
		if err != nil {
			http.Error(w, "failed to search for gifs", http.StatusInternalServerError)
			return
		}

		writeJSON(w, results)
	})
}
