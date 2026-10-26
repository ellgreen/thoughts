package live

import (
	"slices"
	"strings"
	"sync"
)

// Render builds the frame one viewer receives.
type Render func(viewer string) []byte

type Person struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Client struct {
	Person
	Send chan []byte
	// Gone closes when the hub drops the client for falling behind.
	Gone chan struct{}
	once sync.Once
}

func NewClient(p Person) *Client {
	return &Client{Person: p, Send: make(chan []byte, 32), Gone: make(chan struct{})}
}

func (c *Client) drop() { c.once.Do(func() { close(c.Gone) }) }

// Hub is one retro's room. Its lock serialises every change to the retro,
// so each change and the frames it produces go out in the order they
// happened.
type Hub struct {
	mu      sync.Mutex
	clients []*Client
	version int64
}

// Update runs change, which returns how to render the result at the new
// version, and sends that to everyone in the room. An error from change
// sends nothing.
func (h *Hub) Update(change func(version int64) (Render, error)) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	render, err := change(h.version + 1)
	if err != nil {
		return err
	}
	h.version++
	for _, c := range h.clients {
		h.send(c, render(c.ID))
	}
	return nil
}

// Join adds c and sends it the room as it is now.
func (h *Hub) Join(c *Client, snapshot func(version int64) (Render, error)) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	render, err := snapshot(h.version)
	if err != nil {
		return err
	}
	h.clients = append(h.clients, c)
	h.send(c, render(c.ID))
	return nil
}

func (h *Hub) Leave(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients = slices.DeleteFunc(h.clients, func(x *Client) bool { return x == c })
}

// Broadcast sends frame to everyone without changing the version.
func (h *Hub) Broadcast(frame []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, c := range h.clients {
		h.send(c, frame)
	}
}

// People is everyone connected, once each however many tabs they have open.
func (h *Hub) People() []Person {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := []Person{}
	for _, c := range h.clients {
		if !slices.ContainsFunc(out, func(p Person) bool { return p.ID == c.ID }) {
			out = append(out, c.Person)
		}
	}
	slices.SortFunc(out, func(a, b Person) int { return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)) })
	return out
}

// send drops a client whose buffer is full rather than block the room; it
// reconnects and gets a fresh snapshot.
func (h *Hub) send(c *Client, frame []byte) {
	select {
	case c.Send <- frame:
	default:
		c.drop()
	}
}

// Hubs hands out one Hub per retro and forgets it when the last person
// leaves.
type Hubs struct {
	mu   sync.Mutex
	hubs map[string]*entry
}

type entry struct {
	hub  *Hub
	refs int
}

func NewHubs() *Hubs { return &Hubs{hubs: map[string]*entry{}} }

// Len is how many retros have a room open.
func (hs *Hubs) Len() int {
	hs.mu.Lock()
	defer hs.mu.Unlock()
	return len(hs.hubs)
}

func (hs *Hubs) Acquire(retroID string) (*Hub, func()) {
	hs.mu.Lock()
	defer hs.mu.Unlock()
	e, ok := hs.hubs[retroID]
	if !ok {
		e = &entry{hub: &Hub{}}
		hs.hubs[retroID] = e
	}
	e.refs++
	var once sync.Once
	return e.hub, func() {
		once.Do(func() {
			hs.mu.Lock()
			defer hs.mu.Unlock()
			if e.refs--; e.refs == 0 {
				delete(hs.hubs, retroID)
			}
		})
	}
}
