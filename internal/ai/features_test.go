package ai

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type fake struct {
	reply string
	got   Request
}

func (f *fake) Name() string { return "fake" }
func (f *fake) Complete(_ context.Context, r Request) ([]byte, error) {
	f.got = r
	return []byte(f.reply), nil
}

func TestSchemasAreStrict(t *testing.T) {
	// OpenAI's strict mode and Anthropic's structured outputs both need
	// every object closed and every property required.
	var check func(path string, s map[string]any)
	check = func(path string, s map[string]any) {
		switch s["type"] {
		case "object":
			props := s["properties"].(map[string]any)
			if s["additionalProperties"] != false || len(s["required"].([]string)) != len(props) {
				t.Errorf("%s isn't strict: %v", path, s)
			}
			for k, v := range props {
				check(path+"."+k, v.(map[string]any))
			}
		case "array":
			check(path+"[]", s["items"].(map[string]any))
		}
	}
	f := &fake{reply: `{}`}
	ctx := context.Background()
	notes := []Note{{ID: "a"}, {ID: "b"}}
	groups := []GroupNotes{{ID: "g"}}
	_, _ = MakeTemplate(ctx, f, "x")
	check("template", f.got.Schema)
	_, _ = SuggestGroups(ctx, f, notes)
	check("groups", f.got.Schema)
	_, _ = NameGroups(ctx, f, groups)
	check("names", f.got.Schema)
	_, _ = DraftActions(ctx, f, groups, nil)
	check("actions", f.got.Schema)
	_, _ = Recap(ctx, f, "x", groups, nil)
	check("recap", f.got.Schema)
}

func TestTemplate(t *testing.T) {
	f := &fake{reply: `{"theme":" Formula 1 ","columns":[{"title":"Pole position","description":"What put us ahead?"},{"title":"","description":"blank"},{"title":"Pit stop","description":"What slowed us down?"}]}`}
	tpl, err := MakeTemplate(context.Background(), f, "F1")
	if err != nil || tpl.Theme != "Formula 1" || len(tpl.Columns) != 2 {
		t.Fatalf("%+v, %v", tpl, err)
	}
	f.reply = `{"theme":"x","columns":[{"title":"Only one","description":""}]}`
	if _, err := MakeTemplate(context.Background(), f, "F1"); err == nil {
		t.Fatal("one column was accepted")
	}
}

func TestSuggestGroupsDropsWhatTheModelMadeUp(t *testing.T) {
	notes := []Note{{ID: "n1", Column: "Puzzled us", Text: "Flaky\ncheckout test"}, {ID: "n2", Text: "CI reruns"}, {ID: "n3", Text: "Pairing"}, {ID: "n4", Text: "Pair more"}}
	f := &fake{reply: `{"groups":[
		{"title":"CI","noteIds":["n1","n2","n99"]},
		{"title":"Stolen","noteIds":["n2","n3"]},
		{"title":"Alone","noteIds":["n4"]}
	]}`}
	got, err := SuggestGroups(context.Background(), f, notes)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Title != "CI" || strings.Join(got[0].NoteIDs, ",") != "n1,n2" {
		t.Fatalf("groups = %+v", got)
	}
	if !strings.Contains(f.got.Prompt, `id n1, column "Puzzled us": Flaky checkout test`) {
		t.Fatalf("prompt = %s", f.got.Prompt)
	}
}

func TestNamesAndActionsKeepToKnownGroups(t *testing.T) {
	groups := []GroupNotes{{ID: "g1", Notes: []string{"Flaky test"}, Votes: 5}, {ID: "g2", Notes: []string{"Alerts"}, Votes: 3}}
	f := &fake{reply: `{"names":[{"groupId":"g1","title":"Flaky tests"},{"groupId":"g1","title":"Again"},{"groupId":"g9","title":"Ghost"},{"groupId":"g2","title":" "}]}`}
	names, err := NameGroups(context.Background(), f, groups)
	if err != nil || len(names) != 1 || names[0].Title != "Flaky tests" {
		t.Fatalf("names = %+v, %v", names, err)
	}

	f.reply = `{"actions":[{"what":"Quarantine flaky tests","groupId":"g1"},{"what":"Ask about alerts","groupId":"g9"},{"what":"","groupId":"g2"}]}`
	actions, err := DraftActions(context.Background(), f, groups, []string{"Write a runbook"})
	if err != nil || len(actions) != 2 || actions[1].GroupID != "" {
		t.Fatalf("actions = %+v, %v", actions, err)
	}
	if !strings.Contains(f.got.Prompt, "(5 votes)") || !strings.Contains(f.got.Prompt, "Write a runbook") {
		t.Fatalf("prompt = %s", f.got.Prompt)
	}
}

func TestRecap(t *testing.T) {
	f := &fake{reply: mustJSON(map[string]string{"recap": "  The team talked about flaky tests.  "})}
	got, err := Recap(context.Background(), f, "Sprint 41", nil, nil)
	if err != nil || got != "The team talked about flaky tests." {
		t.Fatalf("%q, %v", got, err)
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
