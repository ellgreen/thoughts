package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/session"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// sessionFor issues a request carrying a session cookie for the given user id.
func sessionFor(t *testing.T, sp *session.Provider, userID uuid.UUID) *http.Request {
	t.Helper()

	recorder := httptest.NewRecorder()
	seed := httptest.NewRequest(http.MethodGet, "/api/retros", nil)

	if err := sp.AddUserID(recorder, seed, userID); err != nil {
		t.Fatalf("failed to seed session: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/retros", nil)
	for _, cookie := range recorder.Result().Cookies() {
		req.AddCookie(cookie)
	}

	return req
}

func serve(t *testing.T, db *sqlx.DB, sp *session.Provider, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()

	reached := false

	handler := auth.Middleware(db, sp)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true

		// Panics here are the failure mode we care about: the middleware used
		// to fall through with a nil user after writing an error status.
		if user := auth.UserFromRequest(r); user == nil {
			t.Error("handler reached with no user")
		}

		w.WriteHeader(http.StatusOK)
	}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK && reached {
		t.Errorf("handler ran despite a %d response", recorder.Code)
	}

	return recorder
}

func newProvider(t *testing.T) *session.Provider {
	t.Helper()

	sp, err := session.LoadSessionProvider(filepath.Join(t.TempDir(), "session.key"))
	if err != nil {
		t.Fatalf("failed to load session provider: %v", err)
	}

	return sp
}

func TestMiddlewareAllowsAKnownUser(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	user, err := dal.UserGetOrCreate(context.Background(), db, "Ada")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	if code := serve(t, db, sp, sessionFor(t, sp, user.ID)).Code; code != http.StatusOK {
		t.Errorf("got %d, want 200", code)
	}
}

func TestMiddlewareRejectsASessionForAUserThatNoLongerExists(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	// The state people end up in when their identity row has gone: the cookie
	// still decodes, it just points at nobody. This has to be a clean 401 so
	// the client knows to send them back to the login screen.
	code := serve(t, db, sp, sessionFor(t, sp, uuid.New())).Code

	if code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", code)
	}
}

func TestMiddlewareRejectsARequestWithNoSession(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	req := httptest.NewRequest(http.MethodGet, "/api/retros", nil)

	if code := serve(t, db, sp, req).Code; code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", code)
	}
}

func TestMiddlewareRejectsAnUndecodableCookie(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	// A cookie signed with a different key, which is what a rotated session
	// key looks like from the browser's side.
	other := newProvider(t)
	req := sessionFor(t, other, uuid.New())

	if code := serve(t, db, sp, req).Code; code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", code)
	}
}

func TestMiddlewareStopsOnALookupFailure(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	user, err := dal.UserGetOrCreate(context.Background(), db, "Ada")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	req := sessionFor(t, sp, user.ID)

	// Any lookup failure that is not "no such row". The middleware wrote a 500
	// and then carried on into the handler with a nil user, which panicked.
	db.Close()

	if code := serve(t, db, sp, req).Code; code != http.StatusInternalServerError {
		t.Errorf("got %d, want 500", code)
	}
}
