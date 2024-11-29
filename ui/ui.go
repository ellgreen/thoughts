package ui

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

var dist fs.FS

const (
	distPath  = "dist"
	indexPath = "dist/index.html"
)

func IsBundled() bool {
	return dist != nil
}

func HandlerFunc() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !IsBundled() {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("UI not available, use bundled mode"))
			return
		}

		path := filepath.Join(distPath, r.URL.Path)

		f, err := fs.Stat(dist, path)
		if os.IsNotExist(err) || f.IsDir() {
			http.ServeFileFS(w, r, dist, indexPath)
			return
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		http.ServeFileFS(w, r, dist, path)
	}
}
