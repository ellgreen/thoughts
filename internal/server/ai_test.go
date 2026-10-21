package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ellgreen/thoughts/internal/ai"
	"github.com/ellgreen/thoughts/internal/config"
)

// scripted answers each request with whatever its reply function returns,
// so tests can see the prompt and choose the ids to answer with.
type scripted struct {
	reply func(ai.Request) string
	seen  []ai.Request
}

func (s *scripted) Name() string { return "scripted" }
func (s *scripted) Complete(_ context.Context, r ai.Request) ([]byte, error) {
	s.seen = append(s.seen, r)
	return []byte(s.reply(r)), nil
}

func TestAISuggestionsOverTheSocket(t *testing.T) {
	a := testApp(t)
	model := &scripted{}
	a.ai = model
	srv := httptest.NewServer(a.handler())
	defer srv.Close()

	creator := sessionFrom(t, serve(a, post("/api/auth/name", `{"name":"Priya"}`)))
	r := post("/api/retros", `{"title":"Sprint 41","columns":[{"title":"Went well"},{"title":"Puzzled us"}]}`)
	r.AddCookie(creator)
	var retro retroResource
	_ = json.Unmarshal(serve(a, r).Body.Bytes(), &retro)

	priya := join(t, srv, a, "Priya", retro.ID)
	for _, text := range []string{"The checkout test is flaky", "Two days lost to CI reruns", "Pairing worked"} {
		if msg := priya.do("note.add", map[string]string{"columnId": retro.Columns[1].ID, "content": text}); msg != "" {
			t.Fatal(msg)
		}
	}

	if msg := priya.do("ai.suggest", map[string]string{"kind": "groups"}); !strings.Contains(msg, "group stage") {
		t.Fatalf("suggesting while reflecting: %q", msg)
	}
	if len(model.seen) != 0 {
		t.Fatal("notes went to the model while they were still hidden")
	}

	_ = priya.do("stage.set", map[string]string{"stage": "group"})
	ids := map[string]string{}
	for _, g := range priya.board.Groups {
		ids[g.Notes[0].Content] = g.Notes[0].ID
	}
	model.reply = func(ai.Request) string {
		return `{"groups":[{"title":"Flaky CI","noteIds":["` + ids["The checkout test is flaky"] + `","` + ids["Two days lost to CI reruns"] + `","made-up"]}]}`
	}
	if msg := priya.do("ai.suggest", map[string]string{"kind": "groups"}); msg != "" {
		t.Fatal(msg)
	}
	if strings.Contains(model.seen[0].Prompt, "Priya") {
		t.Fatalf("the author's name went to the model: %s", model.seen[0].Prompt)
	}
	if len(priya.board.Suggestions) != 1 || priya.board.Suggestions[0].Kind != "groups" {
		t.Fatalf("suggestions = %+v", priya.board.Suggestions)
	}

	_ = priya.do("stage.set", map[string]string{"stage": "vote"})
	if msg := priya.do("ai.apply", map[string]string{"id": priya.board.Suggestions[0].ID}); !strings.Contains(msg, "group stage") {
		t.Fatalf("applying groups while voting: %q", msg)
	}
	_ = priya.do("stage.set", map[string]string{"stage": "group"})
	if len(priya.board.Suggestions) != 1 {
		t.Fatal("a refused apply used up the suggestion")
	}
	if msg := priya.do("ai.apply", map[string]string{"id": priya.board.Suggestions[0].ID}); msg != "" {
		t.Fatal(msg)
	}
	if len(priya.board.Groups) != 2 || len(priya.board.Suggestions) != 0 {
		t.Fatalf("after applying: %d groups, %d suggestions", len(priya.board.Groups), len(priya.board.Suggestions))
	}
	var named bool
	for _, g := range priya.board.Groups {
		named = named || (g.Title == "Flaky CI" && len(g.Notes) == 2)
	}
	if !named {
		t.Fatalf("groups = %+v", priya.board.Groups)
	}

	_ = priya.do("stage.set", map[string]string{"stage": "vote"})
	_ = priya.do("vote.cast", map[string]any{"groupId": priya.board.Groups[0].ID, "delta": 1})
	_ = priya.do("stage.set", map[string]string{"stage": "discuss"})
	flaky := priya.board.Groups[0].ID
	model.reply = func(ai.Request) string {
		return `{"actions":[{"what":"Quarantine the checkout test","groupId":"` + flaky + `"},{"what":"Hold a sync about CI","groupId":"` + flaky + `"}]}`
	}
	if msg := priya.do("ai.suggest", map[string]string{"kind": "actions"}); msg != "" {
		t.Fatal(msg)
	}
	drafted := priya.board.Suggestions[0].ID
	if msg := priya.do("ai.dismiss", map[string]any{"id": drafted, "item": 1}); msg != "" {
		t.Fatal(msg)
	}
	if msg := priya.do("ai.apply", map[string]any{"id": drafted, "item": 0}); msg == "" {
		t.Fatal("an item was taken from a suggestion that has since changed")
	}
	if msg := priya.do("ai.apply", map[string]any{"id": priya.board.Suggestions[0].ID, "item": 0}); msg != "" {
		t.Fatal(msg)
	}
	if len(priya.board.Actions) != 1 || priya.board.Actions[0].What != "Quarantine the checkout test" || len(priya.board.Suggestions) != 0 {
		t.Fatalf("after one add and one dismiss: actions %+v, suggestions %+v", priya.board.Actions, priya.board.Suggestions)
	}

	model.reply = func(ai.Request) string { return `{"actions":[]}` }
	if msg := priya.do("ai.suggest", map[string]string{"kind": "actions"}); !strings.Contains(msg, "needs an action") {
		t.Fatalf("no actions: %q", msg)
	}

	model.reply = func(ai.Request) string { return `{"recap":"The team mostly talked about flaky CI."}` }
	if msg := priya.do("ai.suggest", map[string]string{"kind": "recap"}); msg != "" {
		t.Fatal(msg)
	}
	if prompt := model.seen[len(model.seen)-1].Prompt; strings.Contains(prompt, flaky) || !strings.Contains(prompt, "Flaky CI") {
		t.Fatalf("recap prompt = %s", prompt)
	}
	if priya.board.Retro.Recap != "The team mostly talked about flaky CI." {
		t.Fatalf("recap = %q", priya.board.Retro.Recap)
	}
}

func TestAIIsOffWithoutADriver(t *testing.T) {
	a := testApp(t)
	cookie := sessionFrom(t, serve(a, post("/api/auth/name", `{"name":"Sam"}`)))
	r := post("/api/ai/template", `{"theme":"Pirates"}`)
	r.AddCookie(cookie)
	if rec := serve(a, r); rec.Code != http.StatusNotFound {
		t.Fatalf("template with AI off: %d", rec.Code)
	}
	r = httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.AddCookie(cookie)
	if rec := serve(a, r); !strings.Contains(rec.Body.String(), `"ai":false`) {
		t.Fatalf("me = %s", rec.Body)
	}
}

func TestAIProblemsSayWhatWentWrong(t *testing.T) {
	cases := []struct {
		status int
		body   string
		want   string
	}{
		{http.StatusUnauthorized, `{"error":{"message":"Incorrect API key provided: sk-dud. You can find your API key at https://platform.openai.com/account/api-keys.","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}`, "THOUGHTS_AI_API_KEY"},
		{http.StatusNotFound, `{"error":{"message":"The model ` + "`gpt-nope`" + ` does not exist or you do not have access to it.","type":"invalid_request_error","param":null,"code":"model_not_found"}}`, "THOUGHTS_AI_MODEL"},
		{http.StatusTooManyRequests, `{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","param":null,"code":"insufficient_quota"}}`, "out of credit"},
	}
	for _, c := range cases {
		provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After-Ms", "1")
			w.WriteHeader(c.status)
			_, _ = w.Write([]byte(c.body))
		}))
		a := testApp(t)
		a.ai, _ = ai.New(config.AI{Driver: "openai-compatible", BaseURL: provider.URL, Model: "gpt-nope", APIKey: "sk-dud"})
		cookie := sessionFrom(t, serve(a, post("/api/auth/name", `{"name":"Sam"}`)))
		r := post("/api/ai/template", `{"theme":"Pirates"}`)
		r.AddCookie(cookie)
		rec := serve(a, r)
		provider.Close()
		if rec.Code != http.StatusBadGateway || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%d from the provider: %d %s", c.status, rec.Code, rec.Body)
		}
	}
}
