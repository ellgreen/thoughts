package socket

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/ellgreen/thoughts/cmd/thoughts/event"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer. A retro_update carrying a
	// 255 character title plus ten tags is already well over 512 bytes.
	maxMessageSize = 4096

	// Number of outbound messages buffered per client before it is considered
	// stalled and dropped.
	sendBufferSize = 64
)

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	user *model.User
	send chan []byte
}

func NewClient(hub *Hub, conn *websocket.Conn, user *model.User) *Client {
	return &Client{
		hub:  hub,
		conn: conn,
		user: user,
		send: make(chan []byte, sendBufferSize),
	}
}

func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, message, err := c.conn.NextReader()
		if err != nil {
			return
		}

		if err := c.hub.broker.Handle(ctx, c.user, message); err != nil {
			errorEvent := &event.ErrorEvent{}
			if errors.As(err, &errorEvent) {
				c.Send(errorEvent.ToJSON())
				continue
			}

			slog.Error("failed to handle event", "error", err)
		}
	}
}

// Send queues a message for the client. It reports false when the client's
// buffer is full, meaning its write pump has stalled. Blocking here would
// freeze the hub, and with it every broadcast in the retro, so the caller is
// expected to drop the client instead.
func (c *Client) Send(message []byte) bool {
	select {
	case c.send <- message:
		return true
	default:
		return false
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}

			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
