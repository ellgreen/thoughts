package controllers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/controllers"
	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/testutil"
	"github.com/gorilla/mux"
)

// The frontend now refetches this endpoint on every stage change, on the
// assumption that it always reflects the retro's *current* status rather
// than whatever status was in effect when a note was created.
func TestRetroNotesIndexReObfuscatesFromCurrentStatus(t *testing.T) {
	ctx := context.Background()
	db := testutil.NewDB(t)

	retro, err := dal.RetroInsert(ctx, db, "A test retro", model.RetroColumns{
		{Title: "Went well", Description: ""},
	}, false)
	if err != nil {
		t.Fatalf("failed to seed retro: %v", err)
	}

	author, err := dal.UserInsert(ctx, db, "Author")
	if err != nil {
		t.Fatalf("failed to seed author: %v", err)
	}

	viewer, err := dal.UserInsert(ctx, db, "Viewer")
	if err != nil {
		t.Fatalf("failed to seed viewer: %v", err)
	}

	column := retro.GetColumns()[0]

	if _, err := dal.NoteInsert(ctx, db, retro.ID, author.ID, column.ID, "a secret thought"); err != nil {
		t.Fatalf("failed to insert note: %v", err)
	}

	fetchAsViewer := func() string {
		t.Helper()

		req := httptest.NewRequest(http.MethodGet, "/api/retros/"+retro.ID.String()+"/notes", nil)
		req = mux.SetURLVars(req, map[string]string{"id": retro.ID.String()})
		req = auth.RequestWithUser(req, viewer)

		rec := httptest.NewRecorder()
		controllers.RetroNotesIndex(db).ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var notes []struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &notes); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if len(notes) != 1 {
			t.Fatalf("expected 1 note, got %d", len(notes))
		}

		return notes[0].Content
	}

	if got := fetchAsViewer(); got == "a secret thought" {
		t.Errorf("expected another viewer's note to be obfuscated during brainstorm, got the real content")
	}

	if err := dal.RetroUpdateStatus(ctx, db, retro.ID, model.RetroStatusGroup); err != nil {
		t.Fatalf("failed to advance the retro: %v", err)
	}

	if got := fetchAsViewer(); got != "a secret thought" {
		t.Errorf("expected the note in the clear once brainstorm has ended, got %q", got)
	}
}
