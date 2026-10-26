package server

import (
	"strings"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/internal/store"
)

func TestMarkdown(t *testing.T) {
	done := time.Date(2026, 10, 21, 9, 0, 0, 0, time.UTC)
	b := store.Board{
		Retro: store.Retro{Title: "Sprint 41", Stage: store.Discuss, Columns: []store.Column{
			{ID: "c1", Title: "Went well", Description: "What should we keep?"},
			{ID: "c2", Title: "Try next"},
		}},
		Groups: []store.GroupRow{{ID: "g1", ColumnID: "c1"}, {ID: "g2", ColumnID: "c1", Title: "CI"}},
		Notes: []store.Note{
			{ID: "n1", GroupID: "g1", AuthorName: "Priya", Content: "Pairing\nworked"},
			{ID: "n2", GroupID: "g2", AuthorName: "Sam", Content: "Flaky test", ImgURL: "https://example.com/x.gif"},
			{ID: "n3", GroupID: "g2", AuthorName: "Jo", Content: "Reruns"},
		},
		Votes: []store.VoteRow{{GroupID: "g2", Count: 3}},
		Actions: []store.Action{
			{What: "Quarantine flaky tests", Who: "Sam", DueOn: "2026-10-31"},
			{What: "Write it down", DoneAt: &done},
		},
	}
	want := `# Sprint 41

## Actions

- [ ] Quarantine flaky tests (Sam, by 2026-10-31)
- [x] Write it down

## Went well

_What should we keep?_

### CI (3 votes)

- Flaky test (Sam) ![](https://example.com/x.gif)
- Reruns (Jo)

- Pairing worked (Priya)

## Try next

Nothing here.
`
	if got := markdown(b); got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}

	b.Retro.Stage = store.Vote
	if got := markdown(b); strings.Contains(got, "votes") {
		t.Fatalf("vote totals exported while voting:\n%s", got)
	}
}

func TestFileName(t *testing.T) {
	for in, want := range map[string]string{"Sprint 41 / Platform": "sprint-41-platform", "!!!": "retro", "Zoë's retro": "zo-s-retro"} {
		if got := fileName(in); got != want {
			t.Errorf("fileName(%q) = %q, want %q", in, got, want)
		}
	}
}
