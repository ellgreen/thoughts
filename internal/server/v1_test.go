package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ellgreen/thoughts/internal/auth"
	"github.com/ellgreen/thoughts/internal/db"
	"github.com/ellgreen/thoughts/internal/live"
	"github.com/ellgreen/thoughts/internal/store"
	"github.com/ellgreen/thoughts/internal/v1import"
	"github.com/ellgreen/thoughts/migrations"
)

func TestAV1CookieSignsYouInAsTheSamePerson(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join("..", "v1import", "testdata", "1.2.1")
	for _, f := range []string{"thoughts.sqlite", "session.key"} {
		b, err := os.ReadFile(filepath.Join(src, f))
		if err != nil {
			t.Fatal(err)
		}
		_ = os.WriteFile(filepath.Join(dir, f), b, 0o600)
	}
	var fx struct {
		PriyaCookie string `json:"priyaCookie"`
		PriyaID     string `json:"priyaId"`
	}
	raw, _ := os.ReadFile(filepath.Join(src, "fixture.json"))
	_ = json.Unmarshal(raw, &fx)

	ctx := context.Background()
	path := filepath.Join(dir, "thoughts.sqlite")
	d, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if err := importV1(ctx, d, path); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(ctx, d, migrations.FS); err != nil {
		t.Fatal(err)
	}
	v1, err := v1import.LoadSessions(filepath.Join(dir, "session.key"))
	if err != nil {
		t.Fatal(err)
	}
	a := &app{store: store.New(d), providers: []auth.Provider{auth.Name{}}, hubs: live.NewHubs(), v1: v1}

	r := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.AddCookie(&http.Cookie{Name: "session", Value: fx.PriyaCookie})
	rec := serve(a, r)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"id":"`+fx.PriyaID+`"`) {
		t.Fatalf("me with a v1 cookie: %d %s", rec.Code, rec.Body)
	}
	v2 := sessionFrom(t, rec)
	var expired bool
	for _, c := range rec.Result().Cookies() {
		expired = expired || (c.Name == "session" && c.MaxAge < 0)
	}
	if !expired {
		t.Fatal("the v1 cookie wasn't cleared")
	}

	r = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.AddCookie(v2)
	if rec := serve(a, r); rec.Code != http.StatusOK {
		t.Fatalf("me with the new cookie: %d", rec.Code)
	}

	r = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.AddCookie(&http.Cookie{Name: "session", Value: "forged"})
	if rec := serve(a, r); rec.Code != http.StatusUnauthorized {
		t.Fatalf("forged cookie: %d", rec.Code)
	}

	matches, _ := filepath.Glob(filepath.Join(dir, "thoughts.v1-backup-*.sqlite"))
	if len(matches) != 1 {
		t.Fatalf("backups = %v", matches)
	}
}
