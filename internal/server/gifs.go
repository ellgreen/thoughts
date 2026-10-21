package server

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/ellgreen/thoughts/internal/gif"
	"github.com/ellgreen/thoughts/internal/store"
)

func (a *app) searchGIFs(w http.ResponseWriter, r *http.Request, _ store.User) {
	if a.gifs == nil {
		writeError(w, http.StatusServiceUnavailable, "GIF search isn't set up here. Paste a link to an image instead.")
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if utf8.RuneCountInString(q) > 64 {
		writeError(w, http.StatusBadRequest, "Keep the search under 64 characters.")
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))

	var res *gif.SearchPage
	var err error
	if q == "" {
		res, err = a.gifs.Trending(r.Context(), page)
	} else {
		res, err = a.gifs.Search(r.Context(), q, page)
	}
	if err != nil {
		slog.WarnContext(r.Context(), "gif search", "provider", a.gifs.Name(), "err", err)
		writeError(w, http.StatusBadGateway, "Couldn't reach the GIF service. Try again, or paste a link instead.")
		return
	}
	writeJSON(w, http.StatusOK, res)
}
