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

	sp, err := session.LoadSessionProvider(filepath.Join(t.TempDir(), "session.key"), false)
	if err != nil {
		t.Fatalf("failed to load session provider: %v", err)
	}

	return sp
}

func TestMiddlewareAllowsAKnownUser(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	user, err := dal.UserInsert(context.Background(), db, "Ada")
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

	other := newProvider(t)
	req := sessionFor(t, other, uuid.New())

	if code := serve(t, db, sp, req).Code; code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", code)
	}
}

func TestMiddlewareStopsOnALookupFailure(t *testing.T) {
	db := testutil.NewDB(t)
	sp := newProvider(t)

	user, err := dal.UserInsert(context.Background(), db, "Ada")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	req := sessionFor(t, sp, user.ID)

	db.Close()

	if code := serve(t, db, sp, req).Code; code != http.StatusInternalServerError {
		t.Errorf("got %d, want 500", code)
	}
}
