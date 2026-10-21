package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestSPA(t *testing.T) {
	h := spa{fstest.MapFS{
		"index.html":           {Data: []byte("<!doctype html>app")},
		"favicon.svg":          {Data: []byte("<svg></svg>")},
		"assets/index-abc.js":  {Data: []byte("js")},
		"assets/fonts/x.woff2": {Data: []byte("font")},
	}}
	tests := []struct {
		path, body, cache string
	}{
		{"/", "app", "no-cache"},
		{"/retros/3f2a3b8e-8a8e-4c4e-9a59-7d0c1e1f2a3b", "app", "no-cache"},
		{"/tags/platform", "app", "no-cache"},
		{"/login?redirect=%2Fretros%2Fx", "app", "no-cache"},
		{"/favicon.svg", "<svg></svg>", "no-cache"},
		{"/assets/index-abc.js", "js", "immutable"},
		{"/assets", "app", "no-cache"},
	}
	for _, tt := range tests {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), tt.body) || !strings.Contains(rec.Header().Get("Cache-Control"), tt.cache) {
			t.Errorf("%s: %d %q cache=%q", tt.path, rec.Code, rec.Body, rec.Header().Get("Cache-Control"))
		}
	}
}
