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

	// Maximum message size allowed from peer.
	maxMessageSize = 512
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
		send: make(chan []byte),
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

func (c *Client) Send(message []byte) {
	c.send <- message
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
