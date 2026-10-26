package server

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// TestSoak runs several retros at once against the real server and an
// on-disk database, with people joining, leaving, dropping their connection
// and coming back, and one slow reader per retro. Every board anyone
// receives is checked against the rules (hidden notes, private votes, vote
// limits), and at the end everyone must agree, the database must be sound,
// and every room and goroutine must be gone.
//
// A short run happens with every `go test`; a long one with
//
//	THOUGHTS_SOAK=1 go test -race -run Soak -v ./internal/server/
//
// tuned by THOUGHTS_SOAK_RETROS, THOUGHTS_SOAK_PEOPLE, THOUGHTS_SOAK_SECONDS
// and THOUGHTS_SOAK_SEED.
func TestSoak(t *testing.T) {
	if testing.Short() {
		t.Skip("soak test skipped in -short mode")
	}
	cfg := soakConfig{retros: 3, people: 5, duration: 4 * time.Second, seed: uint64(time.Now().UnixNano())}
	if os.Getenv("THOUGHTS_SOAK") != "" {
		cfg = soakConfig{retros: 8, people: 10, duration: 60 * time.Second, seed: cfg.seed}
		cfg.retros = envInt("THOUGHTS_SOAK_RETROS", cfg.retros)
		cfg.people = envInt("THOUGHTS_SOAK_PEOPLE", cfg.people)
		cfg.duration = time.Duration(envInt("THOUGHTS_SOAK_SECONDS", int(cfg.duration.Seconds()))) * time.Second
	}
	if s := os.Getenv("THOUGHTS_SOAK_SEED"); s != "" {
		cfg.seed, _ = strconv.ParseUint(s, 10, 64)
	}
	t.Logf("soak: %d retros, %d people each, %s, seed %d", cfg.retros, cfg.people, cfg.duration, cfg.seed)

	goroutines := runtime.NumGoroutine()
	a := testApp(t)
	srv := httptest.NewServer(a.handler())
	stats := &soakStats{refusals: map[string]int{}}

	var wg sync.WaitGroup
	retros := make([]retroResource, cfg.retros)
	for i := range cfg.retros {
		retros[i] = soakRetro(t, srv.URL, i)
	}
	deadline := time.Now().Add(cfg.duration)
	for i, retro := range retros {
		for p := range cfg.people {
			c := newSoakClient(t, srv.URL, retro, fmt.Sprintf("R%d-P%d", i, p), cfg.seed+uint64(i*1000+p), stats)
			c.slow = p == cfg.people-1
			c.leaves = p == cfg.people-2
			wg.Go(func() { c.run(deadline, p == 0) })
			if p == 1 {
				tab := &soakClient{t: t, base: srv.URL, retro: retro, name: c.name + "-tab2", cookie: c.cookie, me: c.me,
					rng: rand.New(rand.NewPCG(cfg.seed+uint64(i*1000+900), 7)), stats: stats, pending: map[string]chan frame{}}
				wg.Go(func() { tab.run(deadline, false) })
			}
		}
		// Latecomers join part way through.
		for l := range 2 {
			c := newSoakClient(t, srv.URL, retro, fmt.Sprintf("R%d-late%d", i, l), cfg.seed+uint64(i*1000+500+l), stats)
			wg.Go(func() {
				time.Sleep(time.Duration(c.rng.Float64() * 0.6 * float64(cfg.duration)))
				c.run(deadline, false)
			})
		}
	}
	wg.Wait()

	ctx := context.Background()
	waitFor(t, "every room to close once everyone left", func() bool { return a.hubs.Len() == 0 })
	if err := a.store.Check(ctx); err != nil {
		t.Errorf("database after the soak: %v", err)
	}

	for i, retro := range retros {
		x := newSoakClient(t, srv.URL, retro, fmt.Sprintf("R%d-observer-x", i), 1, stats)
		y := newSoakClient(t, srv.URL, retro, fmt.Sprintf("R%d-observer-y", i), 2, stats)
		x.connect()
		y.connect()
		bx, by := x.latest(), y.latest()
		stored, err := a.store.Board(ctx, retro.ID)
		if err != nil {
			t.Fatal(err)
		}
		if bx == nil || by == nil {
			t.Fatalf("retro %d: an observer got no board", i)
		}
		if got, want := noteIDs(bx), noteIDs(by); !slices.Equal(got, want) {
			t.Errorf("retro %d: two observers disagree on the notes", i)
		}
		if len(noteIDs(bx)) != len(stored.Notes) {
			t.Errorf("retro %d: observers see %d notes, the database has %d", i, len(noteIDs(bx)), len(stored.Notes))
		}
		waitFor(t, "both observers to show in presence", func() bool { return len(x.people()) == 2 && len(y.people()) == 2 })
		x.close()
		y.close()
		t.Logf("retro %d ended in %s with %d notes, %d groups, %d actions", i, stored.Retro.Stage, len(stored.Notes), len(bx.Groups), len(stored.Actions))
	}
	waitFor(t, "observers' rooms to close", func() bool { return a.hubs.Len() == 0 })

	srv.CloseClientConnections()
	srv.Close()
	http.DefaultClient.CloseIdleConnections()
	waitFor(t, "goroutines to wind down", func() bool { return runtime.NumGoroutine() <= goroutines+5 })

	stats.report(t)
	if n := stats.serverErrors.Load(); n > 0 {
		t.Errorf("%d commands failed with a server error", n)
	}
	if stats.commands.Load() == 0 || stats.boards.Load() == 0 {
		t.Error("the soak didn't do anything")
	}
}

type soakConfig struct {
	retros, people int
	duration       time.Duration
	seed           uint64
}

type soakStats struct {
	commands, problems, serverErrors, boards, reconnects, dropped atomic.Int64
	mu                                                            sync.Mutex
	latencies                                                     []time.Duration
	refusals                                                      map[string]int
}

func (s *soakStats) took(d time.Duration) {
	s.mu.Lock()
	s.latencies = append(s.latencies, d)
	s.mu.Unlock()
}

func (s *soakStats) report(t *testing.T) {
	s.mu.Lock()
	defer s.mu.Unlock()
	slices.Sort(s.latencies)
	pct := func(p float64) time.Duration {
		if len(s.latencies) == 0 {
			return 0
		}
		return s.latencies[min(len(s.latencies)-1, int(p*float64(len(s.latencies))))]
	}
	t.Logf("soak: %d commands (%d refused by the rules), %d boards delivered, %d reconnects, %d slow readers cut off",
		s.commands.Load(), s.problems.Load(), s.boards.Load(), s.reconnects.Load(), s.dropped.Load())
	for why, n := range s.refusals {
		t.Logf("soak: refused %d× %s", n, why)
	}
	t.Logf("soak: command round trip (slow readers aside) p50 %s, p95 %s, p99 %s, max %s", pct(0.5), pct(0.95), pct(0.99), pct(1))
}

func envInt(key string, fallback int) int {
	if n, err := strconv.Atoi(os.Getenv(key)); err == nil && n > 0 {
		return n
	}
	return fallback
}

func waitFor(t *testing.T, what string, ok func() bool) {
	t.Helper()
	for range 100 {
		if ok() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Errorf("gave up waiting for %s", what)
}

func soakRetro(t *testing.T, base string, i int) retroResource {
	cookie, _ := soakSignIn(t, base, fmt.Sprintf("Host %d", i))
	body := fmt.Sprintf(`{"title":"Soak %d","columns":[{"title":"Went well"},{"title":"Puzzled us"},{"title":"Try next"}]}`, i)
	req, _ := http.NewRequest(http.MethodPost, base+"/api/retros", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var r retroResource
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil || res.StatusCode != http.StatusCreated {
		t.Fatalf("creating retro %d: %d %v", i, res.StatusCode, err)
	}
	return r
}

func soakSignIn(t *testing.T, base, name string) (*http.Cookie, string) {
	res, err := http.Post(base+"/api/auth/name", "application/json", strings.NewReader(`{"name":"`+name+`"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var me meResource
	_ = json.NewDecoder(res.Body).Decode(&me)
	for _, c := range res.Cookies() {
		if c.Name == sessionCookie {
			return c, me.User.ID
		}
	}
	t.Fatalf("no session for %s", name)
	return nil, ""
}

type soakClient struct {
	t      *testing.T
	base   string
	retro  retroResource
	name   string
	cookie *http.Cookie
	me     string
	rng    *rand.Rand
	stats  *soakStats
	slow   bool
	leaves bool

	mu      sync.Mutex
	conn    *websocket.Conn
	board   *boardResource
	present []string
	pending map[string]chan frame
	ref     int
}

func newSoakClient(t *testing.T, base string, retro retroResource, name string, seed uint64, stats *soakStats) *soakClient {
	cookie, me := soakSignIn(t, base, name)
	return &soakClient{t: t, base: base, retro: retro, name: name, cookie: cookie, me: me, rng: rand.New(rand.NewPCG(seed, 7)), stats: stats, pending: map[string]chan frame{}}
}

func (c *soakClient) connect() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	h := http.Header{}
	h.Set("Cookie", c.cookie.String())
	conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(c.base, "http")+"/api/retros/"+c.retro.ID+"/socket", &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		c.t.Errorf("%s connecting: %v", c.name, err)
		return
	}
	conn.SetReadLimit(4 << 20)
	c.mu.Lock()
	c.conn = conn
	c.board = nil
	c.mu.Unlock()
	go c.read(conn)
	for range 500 {
		if c.latest() != nil {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	c.t.Errorf("%s: no board after connecting", c.name)
}

func (c *soakClient) read(conn *websocket.Conn) {
	var last int64 = -1
	for {
		if c.slow && rand.Float64() < 0.02 {
			time.Sleep(1500 * time.Millisecond)
		}
		_, data, err := conn.Read(context.Background())
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusTryAgainLater {
				c.stats.dropped.Add(1)
			}
			c.mu.Lock()
			if c.conn == conn {
				c.conn = nil
			}
			for ref, ch := range c.pending {
				close(ch)
				delete(c.pending, ref)
			}
			c.mu.Unlock()
			return
		}
		var f frame
		if err := json.Unmarshal(data, &f); err != nil {
			c.t.Errorf("%s: unreadable frame: %v", c.name, err)
			continue
		}
		switch f.Type {
		case "board":
			c.stats.boards.Add(1)
			if f.Board.Version < last {
				c.t.Errorf("%s: board version went back from %d to %d", c.name, last, f.Board.Version)
			}
			last = f.Board.Version
			c.check(f.Board)
			c.mu.Lock()
			c.board = f.Board
			c.mu.Unlock()
		case "presence":
			var names []string
			for _, p := range f.People {
				names = append(names, p.ID)
			}
			c.mu.Lock()
			c.present = names
			c.mu.Unlock()
		case "ack", "error":
			if f.Ref == "" {
				c.t.Errorf("%s: error with no command: %s", c.name, f.Message)
				continue
			}
			c.mu.Lock()
			ch := c.pending[f.Ref]
			delete(c.pending, f.Ref)
			c.mu.Unlock()
			if ch != nil {
				ch <- f
			}
		}
	}
}

// check holds a board to the rules for the person it was sent to.
func (c *soakClient) check(b *boardResource) {
	stage := b.Retro.Stage
	fail := func(format string, args ...any) {
		c.t.Errorf("%s (%s): %s", c.name, stage, fmt.Sprintf(format, args...))
	}
	used := 0
	for _, g := range b.Groups {
		if len(g.Notes) == 0 {
			fail("group %s has no notes", g.ID)
		}
		used += g.MyVotes
		if stage != "discuss" && g.Votes != nil {
			fail("vote totals shown before discussion")
		}
		if stage == "discuss" && g.Votes == nil {
			fail("vote totals missing while discussing")
		}
		for _, n := range g.Notes {
			switch {
			case stage == "reflect" && !n.Mine && (!n.Hidden || n.Content != "" || n.ImgURL != "" || n.Author != nil):
				fail("someone else's note leaked while reflecting: %+v", n)
			case stage == "reflect" && n.Mine && (n.Hidden || n.Author != nil):
				fail("own note shown wrongly while reflecting: %+v", n)
			case stage != "reflect" && (n.Hidden || n.Author == nil):
				fail("note still hidden after reflecting: %+v", n)
			case stage != "reflect" && n.Mine != (n.Author.ID == c.me):
				fail("note marked mine wrongly: %+v", n)
			case stage != "discuss" && len(n.Reactions) > 0:
				fail("reactions shown before discussion")
			}
		}
	}
	if used != b.Votes.Used || b.Votes.Used > b.Votes.Max {
		fail("votes used %d (groups say %d) of %d", b.Votes.Used, used, b.Votes.Max)
	}
	if stage == "reflect" && len(b.Suggestions) > 0 {
		fail("suggestions shown while reflecting")
	}
}

func (c *soakClient) latest() *boardResource {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.board
}

func (c *soakClient) people() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.present
}

func (c *soakClient) close() {
	c.mu.Lock()
	conn := c.conn
	c.conn = nil
	c.mu.Unlock()
	if conn != nil {
		_ = conn.Close(websocket.StatusNormalClosure, "")
	}
}

// drop cuts the connection without a goodbye, like a closed laptop lid.
func (c *soakClient) drop() {
	c.mu.Lock()
	conn := c.conn
	c.conn = nil
	c.mu.Unlock()
	if conn != nil {
		_ = conn.CloseNow()
	}
}

// do sends a command and waits for its answer. It returns false if the
// connection went away first.
func (c *soakClient) do(name string, args any) (string, bool) {
	c.mu.Lock()
	conn := c.conn
	if conn == nil {
		c.mu.Unlock()
		return "", false
	}
	c.ref++
	ref := strconv.Itoa(c.ref)
	ch := make(chan frame, 1)
	c.pending[ref] = ch
	c.mu.Unlock()

	raw, _ := json.Marshal(args)
	msg, _ := json.Marshal(inbound{Ref: ref, Name: name, Args: raw})
	start := time.Now()
	c.stats.commands.Add(1)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := conn.Write(ctx, websocket.MessageText, msg); err != nil {
		return "", false
	}
	select {
	case f, ok := <-ch:
		if !ok {
			return "", false
		}
		if !c.slow {
			c.stats.took(time.Since(start))
		}
		if f.Type == "error" {
			if strings.Contains(f.Message, "Something broke") {
				c.stats.serverErrors.Add(1)
				c.t.Errorf("%s: %s failed on the server: %s", c.name, name, f.Message)
			}
			c.stats.problems.Add(1)
			c.stats.mu.Lock()
			c.stats.refusals[name+": "+f.Message]++
			c.stats.mu.Unlock()
			return f.Message, true
		}
		return "", true
	case <-time.After(10 * time.Second):
		c.t.Errorf("%s: no answer to %s within 10s", c.name, name)
		return "", false
	}
}

func (c *soakClient) run(deadline time.Time, drives bool) {
	start := time.Now()
	total := deadline.Sub(start)
	leaveAt := start.Add(time.Duration(c.rng.Float64() * float64(total)))
	c.connect()
	defer c.close()
	for time.Now().Before(deadline) {
		time.Sleep(time.Duration(20+c.rng.IntN(100)) * time.Millisecond)
		if c.leaves && time.Now().After(leaveAt) {
			return
		}
		c.mu.Lock()
		connected := c.conn != nil
		c.mu.Unlock()
		if !connected || c.rng.Float64() < 0.01 {
			c.drop()
			time.Sleep(time.Duration(c.rng.IntN(800)) * time.Millisecond)
			c.stats.reconnects.Add(1)
			c.connect()
			continue
		}
		b := c.latest()
		if b == nil {
			continue
		}
		if drives {
			elapsed := float64(time.Since(start)) / float64(total)
			want := "reflect"
			switch {
			case elapsed > 0.75:
				want = "discuss"
			case elapsed > 0.55:
				want = "vote"
			case elapsed > 0.3:
				want = "group"
			}
			if string(b.Retro.Stage) != want && c.rng.Float64() < 0.5 {
				order := []string{"reflect", "group", "vote", "discuss"}
				next := order[slices.Index(order, string(b.Retro.Stage))+1]
				c.do("stage.set", map[string]string{"stage": next})
				continue
			}
		}
		c.act(b)
	}
}

func (c *soakClient) act(b *boardResource) {
	r := c.rng.Float64()
	pick := func(n int) int { return c.rng.IntN(n) }
	var notes []noteResource
	var mine []noteResource
	for _, g := range b.Groups {
		for _, n := range g.Notes {
			notes = append(notes, n)
			if n.Mine {
				mine = append(mine, n)
			}
		}
	}
	column := b.Retro.Columns[pick(len(b.Retro.Columns))].ID
	switch b.Retro.Stage {
	case "reflect":
		switch {
		case r < 0.6 && len(mine) < notesEach:
			c.do("note.add", map[string]string{"columnId": column, "content": fmt.Sprintf("%s thinks %d", c.name, pick(1000))})
		case r < 0.72 && len(mine) > 0:
			c.do("note.edit", map[string]any{"id": mine[pick(len(mine))].ID, "content": fmt.Sprintf("%s edited %d", c.name, pick(1000))})
		case r < 0.77 && len(mine) > 0:
			c.do("note.delete", map[string]string{"id": mine[pick(len(mine))].ID})
		case r < 0.82 && len(mine) > 0:
			c.do("note.move", map[string]string{"id": mine[pick(len(mine))].ID, "columnId": column})
		case r < 0.9:
			c.do("ready.set", map[string]bool{"ready": c.rng.Float64() < 0.5})
		default:
			c.do([]string{"timer.start", "timer.add", "timer.pause", "timer.resume", "timer.clear"}[pick(5)], map[string]int{"seconds": 30 + pick(300)})
		}
	case "group":
		switch {
		case r < 0.5 && len(notes) > 1:
			g := b.Groups[pick(len(b.Groups))]
			c.do("note.move", map[string]string{"id": notes[pick(len(notes))].ID, "groupId": g.ID})
		case r < 0.65 && len(notes) > 0:
			c.do("note.move", map[string]string{"id": notes[pick(len(notes))].ID, "columnId": column})
		case r < 0.8 && len(b.Groups) > 0:
			c.do("group.name", map[string]string{"id": b.Groups[pick(len(b.Groups))].ID, "title": fmt.Sprintf("Theme %d", pick(50))})
		case r < 0.9 && len(mine) < notesEach:
			c.do("note.add", map[string]string{"columnId": column, "content": c.name + " remembered something"})
		case len(b.Groups) > 0:
			c.do("spotlight.set", map[string]string{"groupId": b.Groups[pick(len(b.Groups))].ID})
		}
	case "vote":
		if len(b.Groups) == 0 {
			return
		}
		delta := 1
		if r < 0.3 {
			delta = -1
		}
		c.do("vote.cast", map[string]any{"groupId": b.Groups[pick(len(b.Groups))].ID, "delta": delta})
	case "discuss":
		switch {
		case r < 0.4 && len(notes) > 0:
			c.do("reaction.set", map[string]any{"noteId": notes[pick(len(notes))].ID, "emoji": []string{"👍", "🎉", "😂", "😮", "👀", "❤️"}[pick(6)], "on": c.rng.Float64() < 0.7})
		case r < 0.6:
			c.do("action.add", map[string]string{"what": fmt.Sprintf("%s will fix %d", c.name, pick(100)), "who": c.name})
		case r < 0.75 && len(b.Actions) > 0:
			c.do("action.done", map[string]any{"id": b.Actions[pick(len(b.Actions))].ID, "done": c.rng.Float64() < 0.5})
		case r < 0.9 && len(b.Groups) > 0:
			c.do("spotlight.set", map[string]string{"groupId": b.Groups[pick(len(b.Groups))].ID})
		default:
			c.do("ready.set", map[string]bool{"ready": true})
		}
	}
}

func noteIDs(b *boardResource) []string {
	var ids []string
	for _, g := range b.Groups {
		for _, n := range g.Notes {
			ids = append(ids, n.ID)
		}
	}
	slices.Sort(ids)
	return ids
}

// notesEach keeps boards the size of a real retro, so the latencies mean
// something; past it people only edit, move and vote.
const notesEach = 8
