package web

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// dist is set by bundled.go when built with -tags bundled. Without it the API
// runs on its own and Vite serves the UI.
var dist fs.FS

func Bundled() bool { return dist != nil }

func Handler() http.Handler {
	if dist == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "The UI isn't built into this binary. Run `pnpm dev` in ui/, or build with -tags bundled.", http.StatusNotFound)
		})
	}
	return spa{dist}
}

type spa struct{ fs fs.FS }

// Anything that isn't a file gets index.html, so /retros/{id} and the other
// client routes, v1's included, deep-link.
func (s spa) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if name != "" && isFile(s.fs, name) {
		if strings.HasPrefix(name, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		http.ServeFileFS(w, r, s.fs, name)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFileFS(w, r, s.fs, "index.html")
}

func isFile(fsys fs.FS, name string) bool {
	info, err := fs.Stat(fsys, name)
	return err == nil && !info.IsDir()
}
