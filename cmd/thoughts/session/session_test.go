package session_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/google/uuid"
)

func newProvider(t *testing.T, tls bool) *session.Provider {
	t.Helper()

	sp, err := session.LoadSessionProvider(filepath.Join(t.TempDir(), "session.key"), tls)
	if err != nil {
		t.Fatalf("failed to load session provider: %v", err)
	}

	return sp
}

// issue performs a login-shaped save and returns the cookie that came back.
func issue(t *testing.T, sp *session.Provider, req *http.Request) *http.Cookie {
	t.Helper()

	recorder := httptest.NewRecorder()

	if err := sp.AddUserID(recorder, req, uuid.New()); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	cookies := recorder.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("no cookie was set")
	}

	return cookies[len(cookies)-1]
}

func TestCookieIsNotSecureOverPlainHTTP(t *testing.T) {
	// gorilla/sessions defaults to Secure with SameSite=None, so the cookie was
	// only ever stored over https. Chrome lets http://localhost away with it,
	// Safari does not, and the login silently failed to stick.
	cookie := issue(t, newProvider(t, false), httptest.NewRequest(http.MethodPost, "/api/auth/login", nil))

	if cookie.Secure {
		t.Error("cookie is marked Secure on a plain http server, so browsers will discard it")
	}

	if cookie.SameSite == http.SameSiteNoneMode {
		t.Error("SameSite=None requires Secure, which drags the same problem back in")
	}
}

func TestCookieIsSecureWhenServingTLS(t *testing.T) {
	cookie := issue(t, newProvider(t, true), httptest.NewRequest(http.MethodPost, "/api/auth/login", nil))

	if !cookie.Secure {
		t.Error("cookie should be Secure when the server terminates TLS")
	}
}

func TestCookieIsSecureBehindAnHTTPSProxy(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	req.Header.Set("X-Forwarded-Proto", "https")

	cookie := issue(t, newProvider(t, false), req)

	if !cookie.Secure {
		t.Error("cookie should be Secure when the request arrived over https")
	}
}

func TestCookieIsHttpOnly(t *testing.T) {
	cookie := issue(t, newProvider(t, false), httptest.NewRequest(http.MethodPost, "/api/auth/login", nil))

	if !cookie.HttpOnly {
		t.Error("the session cookie is never read from JavaScript, so it should be HttpOnly")
	}
}

func TestRoundTripsTheUserID(t *testing.T) {
	sp := newProvider(t, false)

	userID := uuid.New()

	recorder := httptest.NewRecorder()
	if err := sp.AddUserID(recorder, httptest.NewRequest(http.MethodPost, "/api/auth/login", nil), userID); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	next := httptest.NewRequest(http.MethodGet, "/api/retros", nil)
	for _, c := range recorder.Result().Cookies() {
		next.AddCookie(c)
	}

	got, err := sp.GetUserID(httptest.NewRecorder(), next)
	if err != nil {
		t.Fatalf("failed to read the session back: %v", err)
	}

	if got != userID {
		t.Errorf("got %s, want %s", got, userID)
	}
}

func TestForgetClearsTheUserID(t *testing.T) {
	sp := newProvider(t, false)

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)

	if err := sp.AddUserID(recorder, req, uuid.New()); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	loggedIn := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	for _, c := range recorder.Result().Cookies() {
		loggedIn.AddCookie(c)
	}

	out := httptest.NewRecorder()
	if err := sp.ForgetUserID(out, loggedIn); err != nil {
		t.Fatalf("failed to forget: %v", err)
	}

	after := httptest.NewRequest(http.MethodGet, "/api/retros", nil)
	for _, c := range out.Result().Cookies() {
		after.AddCookie(c)
	}

	if _, err := sp.GetUserID(httptest.NewRecorder(), after); err == nil {
		t.Error("expected the session to no longer name a user")
	}
}
