package store

import (
	"errors"
	"testing"
	"time"
)

func TestTimer(t *testing.T) {
	f := newFixture(t)
	start := time.Date(2026, 10, 21, 10, 0, 0, 0, time.UTC)
	at := func(d time.Duration) { f.s.now = func() time.Time { return start.Add(d) } }
	timer := func() Timer {
		r, _ := f.s.Retro(f.ctx, f.retro.ID)
		return r.Timer
	}

	at(0)
	if err := f.s.StartTimer(f.ctx, f.retro.ID, 5); !isProblem(err) {
		t.Fatalf("5 second timer: %v", err)
	}
	if err := f.s.StartTimer(f.ctx, f.retro.ID, 300); err != nil {
		t.Fatal(err)
	}
	if got := timer(); got.EndsAt == nil || !got.EndsAt.Equal(start.Add(5*time.Minute)) {
		t.Fatalf("started = %+v", got)
	}

	at(2 * time.Minute)
	_ = f.s.PauseTimer(f.ctx, f.retro.ID)
	if got := timer(); got.EndsAt != nil || got.Left != 180 {
		t.Fatalf("paused = %+v", got)
	}
	_ = f.s.AddTime(f.ctx, f.retro.ID, 60)
	if got := timer(); got.Left != 240 {
		t.Fatalf("added while paused = %+v", got)
	}

	at(10 * time.Minute)
	_ = f.s.ResumeTimer(f.ctx, f.retro.ID)
	if got := timer(); got.EndsAt == nil || !got.EndsAt.Equal(start.Add(14*time.Minute)) || got.Left != 0 {
		t.Fatalf("resumed = %+v", got)
	}

	at(20 * time.Minute)
	_ = f.s.AddTime(f.ctx, f.retro.ID, 60)
	if got := timer(); !got.EndsAt.Equal(start.Add(21 * time.Minute)) {
		t.Fatalf("adding to a finished timer counts from now: %+v", got)
	}
	_ = f.s.ClearTimer(f.ctx, f.retro.ID)
	if got := timer(); got.EndsAt != nil || got.Left != 0 {
		t.Fatalf("cleared = %+v", got)
	}
}

func TestReadyIsPerStage(t *testing.T) {
	f := newFixture(t)
	_ = f.s.SetReady(f.ctx, f.retro.ID, f.sam, true)
	_ = f.s.SetReady(f.ctx, f.retro.ID, f.sam, true)
	if got := f.board(t).Ready; len(got) != 1 || got[0] != f.sam {
		t.Fatalf("ready = %v", got)
	}
	f.stage(t, Group)
	if got := f.board(t).Ready; len(got) != 0 {
		t.Fatalf("ready after moving on = %v", got)
	}
	f.stage(t, Reflect)
	if got := f.board(t).Ready; len(got) != 1 {
		t.Fatalf("ready after coming back = %v", got)
	}
	_ = f.s.SetReady(f.ctx, f.retro.ID, f.sam, false)
	if got := f.board(t).Ready; len(got) != 0 {
		t.Fatalf("ready after undoing = %v", got)
	}
}

func TestSpotlight(t *testing.T) {
	f := newFixture(t)
	n, _ := f.s.AddNote(f.ctx, f.retro.ID, f.priya, f.column(0), "One")
	if err := f.s.Spotlight(f.ctx, f.retro.ID, n.GroupID); !isProblem(err) {
		t.Fatalf("spotlight while reflecting: %v", err)
	}
	f.stage(t, Group)
	if err := f.s.Spotlight(f.ctx, f.retro.ID, "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown group: %v", err)
	}
	_ = f.s.Spotlight(f.ctx, f.retro.ID, n.GroupID)
	if r, _ := f.s.Retro(f.ctx, f.retro.ID); r.Spotlight != n.GroupID {
		t.Fatalf("spotlight = %q", r.Spotlight)
	}
	_ = f.s.DeleteNote(f.ctx, f.retro.ID, n.ID, f.priya)
	if r, _ := f.s.Retro(f.ctx, f.retro.ID); r.Spotlight != "" {
		t.Fatalf("spotlight on a deleted group = %q", r.Spotlight)
	}
}

func TestTeams(t *testing.T) {
	f := newFixture(t)
	a, err := f.s.CreateTeam(f.ctx, "Platform Team!", "platform team")
	if err != nil || a.Slug != "platform-team" {
		t.Fatalf("%+v, %v", a, err)
	}
	b, _ := f.s.CreateTeam(f.ctx, "Platform team", "")
	if b.Slug != "platform-team-2" {
		t.Fatalf("second slug = %q", b.Slug)
	}
	if r, _ := f.s.Retro(f.ctx, f.retro.ID); r.TeamID != a.ID {
		t.Fatalf("tagged retro didn't join the team: %+v", r)
	}
	if _, err := f.s.CreateRetro(f.ctx, f.sam, NewRetro{Title: "Ghost", TeamID: "nope", Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}}); !isProblem(err) {
		t.Fatalf("retro in a missing team: %v", err)
	}
	teams, _ := f.s.Teams(f.ctx)
	if len(teams) != 2 || teams[0].Slug != "platform-team-2" || teams[1].Retros != 1 {
		t.Fatalf("teams = %+v", teams)
	}
	if got, err := f.s.TeamBySlug(f.ctx, "platform-team"); err != nil || got.ID != a.ID {
		t.Fatalf("by slug = %+v, %v", got, err)
	}

	hidden, _ := f.s.CreateRetro(f.ctx, f.sam, NewRetro{Title: "Hidden", TeamID: b.ID, Unlisted: true, Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}})
	_, _ = f.s.AddAction(f.ctx, hidden.ID, ActionInput{What: "Keep this quiet"})
	if open, _ := f.s.TeamOpenActions(f.ctx, b.ID); len(open) != 0 {
		t.Fatalf("an unlisted retro's actions are on the team page: %+v", open)
	}
	if teams, _ := f.s.Teams(f.ctx); teams[0].OpenActions != 0 {
		t.Fatalf("an unlisted retro's actions are counted: %+v", teams[0])
	}
}

// Both retros are made in the same second here, as they would be by a
// script or a quick facilitator: last time must still find the first.
func TestLastTimeFirst(t *testing.T) {
	f := newFixture(t)
	team, _ := f.s.CreateTeam(f.ctx, "Platform", "platform-team")
	keep, _ := f.s.AddAction(f.ctx, f.retro.ID, ActionInput{What: "Write the runbook", Who: "Tom"})
	drop, _ := f.s.AddAction(f.ctx, f.retro.ID, ActionInput{What: "Try no-meeting Wednesday"})
	done, _ := f.s.AddAction(f.ctx, f.retro.ID, ActionInput{What: "Name an alerts owner"})

	next, err := f.s.CreateRetro(f.ctx, f.priya, NewRetro{Title: "Sprint 42", TeamID: team.ID, Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}})
	if err != nil {
		t.Fatal(err)
	}
	b, err := f.s.Board(f.ctx, next.ID)
	if err != nil {
		t.Fatal(err)
	}
	if b.Team == nil || b.Team.Slug != "platform" || len(b.LastTime) != 3 {
		t.Fatalf("team = %+v, last time = %+v", b.Team, b.LastTime)
	}
	if first, _ := f.s.Board(f.ctx, f.retro.ID); len(first.LastTime) != 0 {
		t.Fatal("a retro's own actions showed as last time")
	}

	for id, outcome := range map[string]string{keep.ID: "carried", drop.ID: "dropped", done.ID: "done"} {
		if err := f.s.CloseEarlier(f.ctx, next.ID, id, outcome); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.s.CloseEarlier(f.ctx, next.ID, keep.ID, "done"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("closing twice: %v", err)
	}
	b, _ = f.s.Board(f.ctx, next.ID)
	if len(b.LastTime) != 0 || len(b.Actions) != 1 || b.Actions[0].CarriedFrom != keep.ID || b.Actions[0].Who != "Tom" {
		t.Fatalf("last time = %+v, actions = %+v", b.LastTime, b.Actions)
	}
	open, _ := f.s.TeamOpenActions(f.ctx, team.ID)
	if len(open) != 1 || open[0].RetroID != next.ID {
		t.Fatalf("open = %+v", open)
	}

	other, _ := f.s.CreateRetro(f.ctx, f.sam, NewRetro{Title: "Elsewhere", Columns: []ColumnInput{{Title: "a"}, {Title: "b"}}})
	if err := f.s.CloseEarlier(f.ctx, other.ID, open[0].ID, "done"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("closed another team's action: %v", err)
	}
}
