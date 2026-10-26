package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ellgreen/thoughts/internal/auth"
	"github.com/ellgreen/thoughts/internal/db"
	"github.com/ellgreen/thoughts/internal/live"
	"github.com/ellgreen/thoughts/internal/store"
	"github.com/ellgreen/thoughts/migrations"
)

func testApp(t *testing.T) *app {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "thoughts.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = d.Close() })
	if err := db.Migrate(context.Background(), d, migrations.FS); err != nil {
		t.Fatal(err)
	}
	return &app{version: "2.0.0-test", store: store.New(d), providers: []auth.Provider{auth.Name{}}, hubs: live.NewHubs()}
}

func serve(a *app, r *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	a.handler().ServeHTTP(rec, r)
	return rec
}

func post(path, body string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

func errorOf(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body %q: %v", rec.Body, err)
	}
	return body["error"]
}

func sessionFrom(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie && c.Value != "" {
			return c
		}
	}
	t.Fatalf("no session cookie in %v", rec.Header().Values("Set-Cookie"))
	return nil
}

func TestHealth(t *testing.T) {
	rec := serve(testApp(t), httptest.NewRequest(http.MethodGet, "/api/health", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"version":"2.0.0-test"`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}

func TestUnknownAPIPathsAre404(t *testing.T) {
	a := testApp(t)
	for _, r := range []*http.Request{
		httptest.NewRequest(http.MethodGet, "/api/nope", nil),
		httptest.NewRequest(http.MethodGet, "/api/retros/x/notes", nil),
		post("/api/auth/ldap", `{}`),
	} {
		if rec := serve(a, r); rec.Code != http.StatusNotFound {
			t.Errorf("%s %s: %d", r.Method, r.URL.Path, rec.Code)
		}
	}
}

func TestProvidersListWhatIsOn(t *testing.T) {
	rec := serve(testApp(t), httptest.NewRequest(http.MethodGet, "/api/auth/providers", nil))
	var body struct {
		Providers []providerResource `json:"providers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Providers) != 1 || body.Providers[0].ID != "name" || body.Providers[0].Fields[0].Name != "name" {
		t.Fatalf("providers = %+v", body.Providers)
	}
}

func TestNameSignInMeAndSignOut(t *testing.T) {
	a := testApp(t)
	rec := serve(a, post("/api/auth/name", `{"name":" Priya "}`))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"Priya"`) {
		t.Fatalf("sign in: %d %s", rec.Code, rec.Body)
	}
	cookie := sessionFrom(t, rec)
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || cookie.Secure {
		t.Fatalf("cookie over plain HTTP = %+v", cookie)
	}

	r := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.AddCookie(cookie)
	if rec := serve(a, r); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"Priya"`) {
		t.Fatalf("me: %d %s", rec.Code, rec.Body)
	}

	r = post("/api/auth/signout", "")
	r.AddCookie(cookie)
	rec = serve(a, r)
	if rec.Code != http.StatusNoContent || !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Fatalf("sign out: %d %q", rec.Code, rec.Header().Get("Set-Cookie"))
	}
	r = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.AddCookie(cookie)
	if rec := serve(a, r); rec.Code != http.StatusUnauthorized {
		t.Fatalf("me after sign out: %d", rec.Code)
	}
}

func TestSignInProblemsAreShown(t *testing.T) {
	a := testApp(t)
	tests := []struct{ body, want string }{
		{`{"name":"A"}`, "Use at least 2 characters."},
		{`{}`, "Add your name."},
		{`{`, "That request didn't make sense to the server. Reload the page and try again."},
	}
	for _, tt := range tests {
		rec := serve(a, post("/api/auth/name", tt.body))
		if rec.Code != http.StatusBadRequest || errorOf(t, rec) != tt.want {
			t.Errorf("%s: %d %s", tt.body, rec.Code, rec.Body)
		}
	}
}

func TestCookieIsSecureBehindHTTPS(t *testing.T) {
	a := testApp(t)
	r := post("/api/auth/name", `{"name":"Sam"}`)
	r.Header.Set("X-Forwarded-Proto", "https")
	if c := sessionFrom(t, serve(a, r)); !c.Secure {
		t.Fatal("cookie behind an HTTPS proxy isn't Secure")
	}
}

func TestSignedOutIs401(t *testing.T) {
	if rec := serve(testApp(t), httptest.NewRequest(http.MethodGet, "/api/me", nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("%d", rec.Code)
	}
}

func TestCrossSitePostsAreRefused(t *testing.T) {
	r := post("/api/auth/name", `{"name":"Sam"}`)
	r.Header.Set("Sec-Fetch-Site", "cross-site")
	if rec := serve(testApp(t), r); rec.Code != http.StatusForbidden {
		t.Fatalf("%d", rec.Code)
	}
}

func TestLocalPath(t *testing.T) {
	for in, want := range map[string]string{
		"/retros/abc?x=1": "/retros/abc?x=1",
		"":                "/",
		"https://x.com":   "/",
		"//x.com":         "/",
		"/\\x.com":        "/",
		"/\t/x.com":       "/",
		"/\n/x.com":       "/",
	} {
		if got := localPath(in); got != want {
			t.Errorf("localPath(%q) = %q, want %q", in, got, want)
		}
	}
}
