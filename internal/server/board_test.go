package server

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/internal/store"
)

func sampleBoard(stage store.Stage) store.Board {
	return store.Board{
		Retro:  store.Retro{ID: "r", Title: "Sprint 41", Stage: stage, MaxVotes: 5, Columns: []store.Column{{ID: "c1", Title: "Went well"}}},
		Groups: []store.GroupRow{{ID: "g1", ColumnID: "c1"}, {ID: "g2", ColumnID: "c1"}, {ID: "empty", ColumnID: "c1"}},
		Notes: []store.Note{
			{ID: "n1", GroupID: "g1", AuthorID: "priya", AuthorName: "Priya", Content: "Pairing worked"},
			{ID: "n2", GroupID: "g2", AuthorID: "sam", AuthorName: "Sam", Content: "Secret thoughts about the flaky checkout test", ImgURL: "https://example.com/cat.gif"},
		},
		Votes:     []store.VoteRow{{UserID: "priya", GroupID: "g2", Count: 2}, {UserID: "sam", GroupID: "g2", Count: 1}},
		Reactions: []store.Reaction{{NoteID: "n1", UserID: "sam", Emoji: "🎉"}, {NoteID: "n1", UserID: "priya", Emoji: "🎉"}},
	}
}

func TestReflectHidesEverythingAboutOtherPeoplesNotes(t *testing.T) {
	res := project(sampleBoard(store.Reflect), "priya", 1, time.Now())
	raw, _ := json.Marshal(res)
	for _, leak := range []string{"Secret", "cat.gif", "Sam", `"sam"`} {
		if strings.Contains(string(raw), leak) {
			t.Errorf("Priya's view while reflecting contains %q: %s", leak, raw)
		}
	}
	own := res.Groups[0].Notes[0]
	if !own.Mine || own.Hidden || own.Content != "Pairing worked" || own.Author != nil {
		t.Fatalf("own note = %+v", own)
	}
	if other := res.Groups[1].Notes[0]; !other.Hidden || other.Size != 2 {
		t.Fatalf("other note = %+v", other)
	}
}

func TestGroupingRevealsNotesAndAuthors(t *testing.T) {
	res := project(sampleBoard(store.Group), "priya", 1, time.Now())
	n := res.Groups[1].Notes[0]
	if n.Hidden || n.Content == "" || n.ImgURL == "" || n.Author == nil || n.Author.Name != "Sam" {
		t.Fatalf("note = %+v", n)
	}
	if len(res.Groups) != 2 {
		t.Fatalf("empty groups should not be shown: %+v", res.Groups)
	}
}

func TestVoteTotalsWaitForDiscussion(t *testing.T) {
	voting := project(sampleBoard(store.Vote), "priya", 1, time.Now())
	if voting.Groups[1].Votes != nil || voting.Groups[1].MyVotes != 2 || voting.Votes.Used != 2 {
		t.Fatalf("while voting = %+v %+v", voting.Groups[1], voting.Votes)
	}
	if strings.Contains(mustJSON(t, voting), `"votes":3`) {
		t.Fatal("total leaked while voting")
	}
	discussing := project(sampleBoard(store.Discuss), "priya", 1, time.Now())
	if discussing.Groups[1].Votes == nil || *discussing.Groups[1].Votes != 3 {
		t.Fatalf("while discussing = %+v", discussing.Groups[1])
	}
	r := discussing.Groups[0].Notes[0].Reactions
	if len(r) != 1 || r[0].Count != 2 || !r[0].Mine {
		t.Fatalf("reactions = %+v", r)
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}
