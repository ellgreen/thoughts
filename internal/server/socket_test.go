package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type person struct {
	t      *testing.T
	conn   *websocket.Conn
	cookie *http.Cookie
	board  *boardResource
	refs   int
}

func join(t *testing.T, srv *httptest.Server, a *app, name, retroID string) *person {
	t.Helper()
	rec := serve(a, post("/api/auth/name", `{"name":"`+name+`"}`))
	cookie := sessionFrom(t, rec)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	h := http.Header{}
	h.Set("Cookie", cookie.String())
	conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(srv.URL, "http")+"/api/retros/"+retroID+"/socket", &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })
	p := &person{t: t, conn: conn, cookie: cookie}
	p.next("board")
	return p
}

// next reads frames until one of type kind arrives, keeping the latest board.
func (p *person) next(kind string) frame {
	p.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		_, data, err := p.conn.Read(ctx)
		if err != nil {
			p.t.Fatalf("waiting for %s: %v", kind, err)
		}
		var f frame
		if err := json.Unmarshal(data, &f); err != nil {
			p.t.Fatal(err)
		}
		if f.Board != nil {
			p.board = f.Board
		}
		if f.Type == kind {
			return f
		}
	}
}

// do sends a command and returns the error message, or "" once it's acked
// and the board it produced has arrived.
func (p *person) do(name string, args any) string {
	p.t.Helper()
	p.refs++
	raw, _ := json.Marshal(args)
	msg, _ := json.Marshal(inbound{Ref: string(rune('a' + p.refs)), Name: name, Args: raw})
	if err := p.conn.Write(context.Background(), websocket.MessageText, msg); err != nil {
		p.t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	sawBoard := false
	for {
		_, data, err := p.conn.Read(ctx)
		if err != nil {
			p.t.Fatal(err)
		}
		var f frame
		_ = json.Unmarshal(data, &f)
		if f.Board != nil {
			p.board, sawBoard = f.Board, true
		}
		if f.Type == "error" {
			return f.Message
		}
		if f.Type == "ack" {
			if !sawBoard {
				p.next("board")
			}
			return ""
		}
	}
}

func TestARetroOverTheSocket(t *testing.T) {
	a := testApp(t)
	srv := httptest.NewServer(a.handler())
	defer srv.Close()

	creator := sessionFrom(t, serve(a, post("/api/auth/name", `{"name":"Priya"}`)))
	r := post("/api/retros", `{"title":"Sprint 41","columns":[{"title":"Went well"},{"title":"Puzzled us"}],"tags":["platform"]}`)
	r.AddCookie(creator)
	rec := serve(a, r)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	var retro retroResource
	_ = json.Unmarshal(rec.Body.Bytes(), &retro)

	priya := join(t, srv, a, "Priya", retro.ID)
	sam := join(t, srv, a, "Sam", retro.ID)
	for len(priya.next("presence").People) != 2 {
	}

	if msg := priya.do("note.add", map[string]string{"columnId": retro.Columns[0].ID, "content": "The checkout test is flaky"}); msg != "" {
		t.Fatal(msg)
	}
	sam.next("board")
	raw, _ := json.Marshal(sam.board)
	if strings.Contains(string(raw), "checkout") || strings.Contains(string(raw), "Priya") {
		t.Fatalf("Sam can read Priya's note while reflecting: %s", raw)
	}
	if n := sam.board.Groups[0].Notes[0]; !n.Hidden {
		t.Fatalf("note = %+v", n)
	}

	if msg := sam.do("stage.set", map[string]string{"stage": "discuss"}); msg != "Stages move one step at a time." {
		t.Fatalf("jump: %q", msg)
	}
	if msg := sam.do("stage.set", map[string]string{"stage": "group"}); msg != "" {
		t.Fatal(msg)
	}
	priya.next("board")
	if n := sam.board.Groups[0].Notes[0]; n.Hidden || n.Content != "The checkout test is flaky" || n.Author.Name != "Priya" {
		t.Fatalf("after reveal = %+v", n)
	}

	_ = sam.do("stage.set", map[string]string{"stage": "vote"})
	group := sam.board.Groups[0].ID
	for range 5 {
		if msg := sam.do("vote.cast", map[string]any{"groupId": group, "delta": 1}); msg != "" {
			t.Fatal(msg)
		}
	}
	if msg := sam.do("vote.cast", map[string]any{"groupId": group, "delta": 1}); !strings.HasPrefix(msg, "You've used all 5 votes") {
		t.Fatalf("sixth vote: %q", msg)
	}
	if sam.board.Votes.Used != 5 || sam.board.Groups[0].Votes != nil {
		t.Fatalf("sam's votes = %+v, group = %+v", sam.board.Votes, sam.board.Groups[0])
	}

	if msg := priya.do("nonsense", nil); !strings.Contains(msg, "doesn't know how") {
		t.Fatalf("unknown command: %q", msg)
	}
}

func TestSocketNeedsARealRetroAndASession(t *testing.T) {
	a := testApp(t)
	cookie := sessionFrom(t, serve(a, post("/api/auth/name", `{"name":"Sam"}`)))
	r := httptest.NewRequest(http.MethodGet, "/api/retros/nope/socket", nil)
	r.AddCookie(cookie)
	if rec := serve(a, r); rec.Code != http.StatusNotFound {
		t.Fatalf("missing retro: %d", rec.Code)
	}
	if rec := serve(a, httptest.NewRequest(http.MethodGet, "/api/retros/nope/socket", nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out: %d", rec.Code)
	}
}

func TestShutdownClosesSockets(t *testing.T) {
	a := testApp(t)
	a.closing = make(chan struct{})
	srv := httptest.NewServer(a.handler())
	defer srv.Close()

	creator := sessionFrom(t, serve(a, post("/api/auth/name", `{"name":"Priya"}`)))
	r := post("/api/retros", `{"title":"Sprint 41","columns":[{"title":"Went well"},{"title":"Puzzled us"}]}`)
	r.AddCookie(creator)
	var retro retroResource
	_ = json.Unmarshal(serve(a, r).Body.Bytes(), &retro)
	priya := join(t, srv, a, "Priya", retro.ID)

	close(a.closing)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		if _, _, err := priya.conn.Read(ctx); err != nil {
			if ctx.Err() != nil {
				t.Fatal("the socket stayed open after shutdown began")
			}
			break
		}
	}
	done := make(chan struct{})
	go func() {
		a.sockets.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
		t.Fatal("the socket handler didn't finish")
	}
}
