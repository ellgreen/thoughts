package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/coder/websocket"

	"github.com/ellgreen/thoughts/internal/live"
	"github.com/ellgreen/thoughts/internal/store"
)

const (
	maxFrame    = 16 << 10
	writeWait   = 10 * time.Second
	pingEvery   = 30 * time.Second
	commandWait = 10 * time.Second
)

type inbound struct {
	Ref  string          `json:"ref"`
	Name string          `json:"name"`
	Args json.RawMessage `json:"args"`
}

type frame struct {
	Type    string         `json:"type"`
	Ref     string         `json:"ref,omitempty"`
	Message string         `json:"message,omitempty"`
	Board   *boardResource `json:"board,omitempty"`
	People  []live.Person  `json:"people,omitempty"`
}

func encode(f frame) []byte {
	b, _ := json.Marshal(f)
	return b
}

// boardRender loads the board once and projects it for each viewer.
func (a *app) boardRender(ctx context.Context, retroID string, version int64) (live.Render, error) {
	b, err := a.store.Board(ctx, retroID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	return func(viewer string) []byte {
		res := project(b, viewer, version, now)
		return encode(frame{Type: "board", Board: &res})
	}, nil
}

func (a *app) socket(w http.ResponseWriter, r *http.Request, u store.User) {
	retroID := r.PathValue("id")
	if _, err := a.store.Retro(r.Context(), retroID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "There's no retro at that link.")
		return
	} else if err != nil {
		fail(w, r, err)
		return
	}

	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	conn.SetReadLimit(maxFrame)
	a.sockets.Add(1)
	defer a.sockets.Done()
	// Shutdown doesn't track hijacked connections, so closing tells each
	// socket the server is going.
	ctx, cancel := context.WithCancel(context.WithoutCancel(r.Context()))
	defer cancel()
	go func() {
		select {
		case <-a.closing:
			cancel()
		case <-ctx.Done():
		}
	}()

	hub, release := a.hubs.Acquire(retroID)
	defer release()
	client := live.NewClient(live.Person{ID: u.ID, Name: u.Name})
	if err := hub.Join(client, func(v int64) (live.Render, error) { return a.boardRender(ctx, retroID, v) }); err != nil {
		slog.ErrorContext(ctx, "joining retro", "retro", retroID, "err", err)
		_ = conn.Close(websocket.StatusInternalError, "could not load the retro")
		return
	}
	hub.Broadcast(encode(frame{Type: "presence", People: hub.People()}))
	defer func() {
		hub.Leave(client)
		hub.Broadcast(encode(frame{Type: "presence", People: hub.People()}))
	}()

	go a.writeLoop(ctx, cancel, conn, client)

	for {
		var in inbound
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if err := json.Unmarshal(data, &in); err != nil {
			if !deliver(ctx, client, encode(frame{Type: "error", Message: "That message didn't make sense to the server."})) {
				return
			}
			continue
		}
		// An AI suggestion can take a minute; run it aside so the person
		// can carry on working while it does.
		if in.Name == "ai.suggest" {
			a.sockets.Go(func() { deliver(ctx, client, a.run(ctx, hub, retroID, u, in)) })
			continue
		}
		if !deliver(ctx, client, a.run(ctx, hub, retroID, u, in)) {
			return
		}
	}
}

func deliver(ctx context.Context, c *live.Client, msg []byte) bool {
	select {
	case c.Send <- msg:
		return true
	case <-c.Gone:
		return false
	case <-ctx.Done():
		return false
	}
}

func (a *app) run(ctx context.Context, hub *live.Hub, retroID string, u store.User, in inbound) []byte {
	var err error
	if in.Name == "ai.suggest" {
		err = a.suggest(ctx, hub, retroID, in.Args)
	} else if cmd, ok := commands[in.Name]; !ok {
		err = unknownCommand(in.Name)
	} else {
		ctx, cancel := context.WithTimeout(ctx, commandWait)
		defer cancel()
		err = hub.Update(func(v int64) (live.Render, error) {
			if err := cmd(ctx, a.store, retroID, u, in.Args); err != nil {
				return nil, err
			}
			return a.boardRender(ctx, retroID, v)
		})
	}
	var problem store.Problem
	switch {
	case err == nil:
		return encode(frame{Type: "ack", Ref: in.Ref})
	case errors.As(err, &problem):
		return encode(frame{Type: "error", Ref: in.Ref, Message: problem.Error()})
	case errors.Is(err, store.ErrNotFound):
		return encode(frame{Type: "error", Ref: in.Ref, Message: "That's not there any more. Someone may have just removed it."})
	default:
		slog.ErrorContext(ctx, "command failed", "retro", retroID, "command", in.Name, "err", err)
		return encode(frame{Type: "error", Ref: in.Ref, Message: "Something broke on the server. Try again in a moment."})
	}
}

func (a *app) writeLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, c *live.Client) {
	defer cancel()
	ping := time.NewTicker(pingEvery)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			_ = conn.Close(websocket.StatusNormalClosure, "")
			return
		case <-c.Gone:
			_ = conn.Close(websocket.StatusTryAgainLater, "fell behind; reconnect for a fresh copy")
			return
		case msg := <-c.Send:
			wctx, done := context.WithTimeout(ctx, writeWait)
			err := conn.Write(wctx, websocket.MessageText, msg)
			done()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, done := context.WithTimeout(ctx, writeWait)
			err := conn.Ping(pctx)
			done()
			if err != nil {
				return
			}
		}
	}
}
