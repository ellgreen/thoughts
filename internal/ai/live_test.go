package ai

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/internal/config"
)

// TestLiveDriver checks the configured driver against the real provider:
//
//	THOUGHTS_AI_LIVE_TEST=1 THOUGHTS_AI_DRIVER=anthropic THOUGHTS_AI_API_KEY=... go test -run Live ./internal/ai/
//
// It spends a little of the provider's quota, so it only runs when asked.
func TestLiveDriver(t *testing.T) {
	if os.Getenv("THOUGHTS_AI_LIVE_TEST") == "" {
		t.Skip("set THOUGHTS_AI_LIVE_TEST=1 and THOUGHTS_AI_DRIVER (and its settings) to run")
	}
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	d, err := New(cfg.AI)
	if err != nil || d == nil {
		t.Fatalf("driver = %v, %v", d, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()

	tpl, err := MakeTemplate(ctx, d, "a heist film")
	if err != nil {
		t.Fatalf("template: %v", err)
	}
	if len(tpl.Columns) < 2 || len(tpl.Columns) > 5 {
		t.Fatalf("template = %+v", tpl)
	}
	t.Logf("template: %+v", tpl)

	notes := []Note{
		{ID: "n1", Column: "Puzzled us", Text: "The checkout test failed nine times and passed on retry"},
		{ID: "n2", Column: "Puzzled us", Text: "We lost two days to re-running CI"},
		{ID: "n3", Column: "Went well", Text: "Pairing on the billing migration meant nobody was stuck"},
		{ID: "n4", Column: "Try next", Text: "Pair on every risky change"},
		{ID: "n5", Column: "Went well", Text: "Shipped on a Friday and nothing broke"},
	}
	groups, err := SuggestGroups(ctx, d, notes)
	if err != nil {
		t.Fatalf("groups: %v", err)
	}
	if len(groups) == 0 {
		t.Fatal("no groups suggested for obviously related notes")
	}
	t.Logf("groups: %+v", groups)

	placeholders := []GroupNotes{
		{ID: "01a15ef6-3e78-7001-83d9-743843a712db", Notes: []string{"Some note"}, Votes: 3},
		{ID: "01a1603e-0d39-7000-8742-fdca56f86361", Notes: []string{"Another not", "Another note here"}, Votes: 3},
	}
	actions, err := DraftActions(ctx, d, placeholders, nil)
	if err != nil {
		t.Fatalf("actions: %v", err)
	}
	if len(actions) != 0 {
		t.Fatalf("actions drafted for placeholder notes: %+v", actions)
	}

	topics := []GroupNotes{
		{ID: "01a15ef6-3e78-7001-83d9-743843a712db", Title: "Flaky CI", Notes: []string{notes[0].Text, notes[1].Text}, Votes: 5},
		{ID: "01a1603e-0d39-7000-8742-fdca56f86361", Notes: []string{notes[2].Text, notes[3].Text}, Votes: 3},
	}
	actions, err = DraftActions(ctx, d, topics, nil)
	if err != nil {
		t.Fatalf("actions: %v", err)
	}
	if len(actions) == 0 || len(actions) > 3 {
		t.Fatalf("actions = %+v", actions)
	}
	t.Logf("actions: %+v", actions)

	recap, err := Recap(ctx, d, "Sprint 41", topics, []string{actions[0].What})
	if err != nil {
		t.Fatalf("recap: %v", err)
	}
	if strings.Contains(recap, "01a1") || strings.Contains(recap, "group ") {
		t.Fatalf("the recap quotes ids: %s", recap)
	}
	t.Logf("recap: %s", recap)
}
