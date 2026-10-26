package store

import (
	"context"
	"errors"
	"testing"
)

type fixture struct {
	s      *Store
	retro  Retro
	priya  string
	sam    string
	ctx    context.Context
	column func(i int) string
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	s := testStore(t)
	ctx := context.Background()
	p, _ := s.SignIn(ctx, Identity{Provider: "name", Name: "Priya"})
	m, _ := s.SignIn(ctx, Identity{Provider: "name", Name: "Sam"})
	r, err := s.CreateRetro(ctx, p.ID, NewRetro{Title: "Sprint 41", Columns: []ColumnInput{{Title: "Went well"}, {Title: "Puzzled us"}, {Title: "Try next"}}, Tags: []string{"Platform Team"}})
	if err != nil {
		t.Fatal(err)
	}
	return fixture{s: s, retro: r, priya: p.ID, sam: m.ID, ctx: ctx, column: func(i int) string { return r.Columns[i].ID }}
}

func (f fixture) stage(t *testing.T, to ...Stage) {
	t.Helper()
	for _, st := range to {
		if err := f.s.SetStage(f.ctx, f.retro.ID, st); err != nil {
			t.Fatalf("to %s: %v", st, err)
		}
	}
}

func (f fixture) board(t *testing.T) Board {
	t.Helper()
	b, err := f.s.Board(f.ctx, f.retro.ID)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func isProblem(err error) bool {
	var p Problem
	return errors.As(err, &p)
}

func TestCreateRetroCleansInput(t *testing.T) {
	f := newFixture(t)
	if f.retro.Stage != Reflect || f.retro.MaxVotes != DefaultVotes || len(f.retro.Columns) != 3 {
		t.Fatalf("retro = %+v", f.retro)
	}
	if len(f.retro.Tags) != 1 || f.retro.Tags[0] != "platform-team" {
		t.Fatalf("tags = %v", f.retro.Tags)
	}
	for _, in := range []NewRetro{
		{Title: "", Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}},
		{Title: "Sprint", Columns: []ColumnInput{{Title: "a"}}},
		{Title: "Sprint", Columns: []ColumnInput{{Title: "a"}, {Title: " "}}},
	} {
		if _, err := f.s.CreateRetro(f.ctx, f.priya, in); !isProblem(err) {
			t.Errorf("%+v: err = %v", in, err)
		}
	}
}

func TestStagesMoveOneStepAtATime(t *testing.T) {
	f := newFixture(t)
	if err := f.s.SetStage(f.ctx, f.retro.ID, Vote); !isProblem(err) {
		t.Fatalf("jump: %v", err)
	}
	f.stage(t, Group, Vote, Group, Vote, Discuss)
	if err := f.s.SetStage(f.ctx, f.retro.ID, "lunch"); !isProblem(err) {
		t.Fatalf("unknown: %v", err)
	}
}

func TestOnlyTheAuthorChangesANote(t *testing.T) {
	f := newFixture(t)
	n, err := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "  Pairing worked  ")
	if err != nil || n.Content != "Pairing worked" {
		t.Fatalf("%+v, %v", n, err)
	}
	text := "Changed"
	if err := f.s.EditNote(f.ctx, f.retro.ID, n.ID, f.sam, NoteEdit{Content: &text}); !isProblem(err) {
		t.Fatalf("Sam edited Priya's note: %v", err)
	}
	if err := f.s.DeleteNote(f.ctx, f.retro.ID, n.ID, f.sam); !isProblem(err) {
		t.Fatalf("Sam deleted Priya's note: %v", err)
	}
	img := "http://example.com/x.gif"
	if err := f.s.EditNote(f.ctx, f.retro.ID, n.ID, f.priya, NoteEdit{ImgURL: &img}); !isProblem(err) {
		t.Fatalf("http image: %v", err)
	}
	img = "https://example.com/x.gif"
	if err := f.s.EditNote(f.ctx, f.retro.ID, n.ID, f.priya, NoteEdit{Content: &text, ImgURL: &img}); err != nil {
		t.Fatal(err)
	}
	b := f.board(t)
	if b.Notes[0].Content != "Changed" || b.Notes[0].ImgURL != img || b.Notes[0].AuthorName != "Priya" {
		t.Fatalf("note = %+v", b.Notes[0])
	}
}

func TestNotesInAnotherRetroAreNotFound(t *testing.T) {
	f := newFixture(t)
	other, _ := f.s.CreateRetro(f.ctx, f.sam, NewRetro{Title: "Other", Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}})
	n, _ := f.s.AddNote(f.ctx, other.ID, f.sam, other.Columns[0].ID, "Elsewhere")
	if err := f.s.DeleteNote(f.ctx, f.retro.ID, n.ID, f.sam); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	if _, err := f.s.AddNote(f.ctx, f.retro.ID, f.sam, other.Columns[0].ID, "Wrong column"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestGroupingRules(t *testing.T) {
	f := newFixture(t)
	a, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(1), "Flaky test")
	b, _ := f.s.AddNote(f.ctx, f.retro.ID, f.sam, f.column(1), "CI reruns")

	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.priya, f.column(0), ""); !isProblem(err) {
		t.Fatalf("moved someone else's note while reflecting: %v", err)
	}
	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.sam, "", a.GroupID); !isProblem(err) {
		t.Fatalf("grouped while reflecting: %v", err)
	}
	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.sam, f.column(2), ""); err != nil {
		t.Fatalf("author moving between columns: %v", err)
	}

	f.stage(t, Group)
	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.priya, "", a.GroupID); err != nil {
		t.Fatal(err)
	}
	board := f.board(t)
	if len(board.Groups) != 1 || board.Notes[1].GroupID != a.GroupID {
		t.Fatalf("groups = %+v notes = %+v", board.Groups, board.Notes)
	}
	if err := f.s.NameGroup(f.ctx, f.retro.ID, a.GroupID, "  CI  "); err != nil {
		t.Fatal(err)
	}
	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.priya, f.column(1), ""); err != nil {
		t.Fatal(err)
	}
	board = f.board(t)
	if len(board.Groups) != 2 || board.Groups[0].Title != "CI" {
		t.Fatalf("groups after ungrouping = %+v", board.Groups)
	}

	f.stage(t, Vote)
	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.sam, f.column(0), ""); !isProblem(err) {
		t.Fatalf("moved while voting: %v", err)
	}
}

func TestVotesStackUpToTheLimit(t *testing.T) {
	f := newFixture(t)
	a, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "One")
	b, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "Two")
	if err := f.s.CastVote(f.ctx, f.retro.ID, a.GroupID, f.sam, 1); !isProblem(err) {
		t.Fatalf("voted while reflecting: %v", err)
	}
	f.stage(t, Group, Vote)
	if err := f.s.UpdateRetro(f.ctx, f.retro.ID, RetroSettings{Title: "Sprint 41", MaxVotes: 3}); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := f.s.CastVote(f.ctx, f.retro.ID, a.GroupID, f.sam, 1); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.s.CastVote(f.ctx, f.retro.ID, b.GroupID, f.sam, 1); err != nil {
		t.Fatal(err)
	}
	if err := f.s.CastVote(f.ctx, f.retro.ID, b.GroupID, f.sam, 1); !isProblem(err) {
		t.Fatalf("fourth vote of three: %v", err)
	}
	if err := f.s.CastVote(f.ctx, f.retro.ID, a.GroupID, f.priya, 1); err != nil {
		t.Fatalf("Priya's votes are separate from Sam's: %v", err)
	}
	if err := f.s.CastVote(f.ctx, f.retro.ID, b.GroupID, f.sam, -1); err != nil {
		t.Fatal(err)
	}
	if err := f.s.CastVote(f.ctx, f.retro.ID, b.GroupID, f.sam, -1); err != nil {
		t.Fatalf("taking back a vote you don't have is a no-op: %v", err)
	}
	got := map[string]int{}
	for _, v := range f.board(t).Votes {
		if v.UserID == f.sam {
			got[v.GroupID] = v.Count
		}
	}
	if got[a.GroupID] != 2 || got[b.GroupID] != 0 {
		t.Fatalf("Sam's votes = %v", got)
	}
}

func TestVotesFollowANoteWhenGroupingReopens(t *testing.T) {
	f := newFixture(t)
	a, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "One")
	b, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "Two")
	f.stage(t, Group, Vote)
	_ = f.s.CastVote(f.ctx, f.retro.ID, a.GroupID, f.sam, 1)
	_ = f.s.CastVote(f.ctx, f.retro.ID, b.GroupID, f.sam, 1)
	_ = f.s.CastVote(f.ctx, f.retro.ID, b.GroupID, f.priya, 1)
	f.stage(t, Group)

	if err := f.s.MoveNote(f.ctx, f.retro.ID, b.ID, f.sam, "", a.GroupID); err != nil {
		t.Fatal(err)
	}
	got := map[string]int{}
	for _, v := range f.board(t).Votes {
		if v.GroupID != a.GroupID {
			t.Fatalf("a vote was left on the emptied group: %+v", v)
		}
		got[v.UserID] = v.Count
	}
	if got[f.sam] != 2 || got[f.priya] != 1 {
		t.Fatalf("votes after merging = %v", got)
	}

	if err := f.s.MoveNote(f.ctx, f.retro.ID, a.ID, f.sam, f.column(1), ""); err != nil {
		t.Fatal(err)
	}
	if votes := f.board(t).Votes; len(votes) != 2 || votes[0].GroupID != a.GroupID {
		t.Fatalf("votes after taking a note out = %+v", votes)
	}
}

func TestReactionsOnlyWhileDiscussing(t *testing.T) {
	f := newFixture(t)
	n, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "One")
	if err := f.s.React(f.ctx, f.retro.ID, n.ID, f.sam, "👍", true); !isProblem(err) {
		t.Fatalf("reacted while reflecting: %v", err)
	}
	f.stage(t, Group, Vote, Discuss)
	if err := f.s.React(f.ctx, f.retro.ID, n.ID, f.sam, "🦆", true); !isProblem(err) {
		t.Fatalf("odd emoji: %v", err)
	}
	for range 2 {
		if err := f.s.React(f.ctx, f.retro.ID, n.ID, f.sam, "👍", true); err != nil {
			t.Fatal(err)
		}
	}
	if got := len(f.board(t).Reactions); got != 1 {
		t.Fatalf("reactions = %d", got)
	}
	_ = f.s.React(f.ctx, f.retro.ID, n.ID, f.sam, "👍", false)
	if got := len(f.board(t).Reactions); got != 0 {
		t.Fatalf("reactions after removing = %d", got)
	}
}

func TestColumns(t *testing.T) {
	f := newFixture(t)
	for i := range 2 {
		if _, err := f.s.AddColumn(f.ctx, f.retro.ID, ColumnInput{Title: "Extra", Description: string(rune('a' + i))}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := f.s.AddColumn(f.ctx, f.retro.ID, ColumnInput{Title: "Sixth"}); !isProblem(err) {
		t.Fatalf("sixth column: %v", err)
	}
	_, _ = f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "Keeps it")
	if err := f.s.DeleteColumn(f.ctx, f.retro.ID, f.column(0)); !isProblem(err) {
		t.Fatalf("deleted a column with notes: %v", err)
	}
	r, _ := f.s.Retro(f.ctx, f.retro.ID)
	if r.Columns[4].Title != "Extra" || r.Columns[4].Description != "b" {
		t.Fatalf("columns = %+v", r.Columns)
	}
	for _, c := range r.Columns[2:] {
		_ = f.s.DeleteColumn(f.ctx, f.retro.ID, c.ID)
	}
	if err := f.s.DeleteColumn(f.ctx, f.retro.ID, f.column(1)); !isProblem(err) {
		t.Fatalf("went below two columns: %v", err)
	}
}

func TestActions(t *testing.T) {
	f := newFixture(t)
	a, err := f.s.AddAction(f.ctx, f.retro.ID, ActionInput{What: "Quarantine flaky tests", Who: "Sam", DueOn: "2026-10-31"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.AddAction(f.ctx, f.retro.ID, ActionInput{What: "Thing", DueOn: "next week"}); !isProblem(err) {
		t.Fatalf("bad date: %v", err)
	}
	if err := f.s.SetActionDone(f.ctx, f.retro.ID, a.ID, true); err != nil {
		t.Fatal(err)
	}
	b := f.board(t)
	if len(b.Actions) != 1 || b.Actions[0].DoneAt == nil || b.Actions[0].DueOn != "2026-10-31" {
		t.Fatalf("actions = %+v", b.Actions)
	}
	other, _ := f.s.CreateRetro(f.ctx, f.sam, NewRetro{Title: "Other", Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}})
	if err := f.s.SetActionDone(f.ctx, other.ID, a.ID, false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("changed an action through another retro: %v", err)
	}
}

func TestListingAndTags(t *testing.T) {
	f := newFixture(t)
	_, _ = f.s.CreateRetro(f.ctx, f.sam, NewRetro{Title: "Secret", Unlisted: true, Tags: []string{"platform-team"}, Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}})
	_, _ = f.s.AddAction(f.ctx, f.retro.ID, ActionInput{What: "Do the thing"})

	list, err := f.s.ListRetros(f.ctx, "", 25)
	if err != nil || len(list) != 1 || list[0].Title != "Sprint 41" || list[0].Actions != 1 {
		t.Fatalf("list = %+v, %v", list, err)
	}
	tagged, _ := f.s.ListRetros(f.ctx, "platform-team", 25)
	if len(tagged) != 1 {
		t.Fatalf("tagged = %+v", tagged)
	}
	open, _ := f.s.OpenActions(f.ctx, "platform-team")
	if len(open) != 1 || open[0].RetroTitle != "Sprint 41" {
		t.Fatalf("open = %+v", open)
	}
	tags, _ := f.s.Tags(f.ctx)
	if len(tags) != 1 || tags[0] != "platform-team" {
		t.Fatalf("tags = %v", tags)
	}
}
