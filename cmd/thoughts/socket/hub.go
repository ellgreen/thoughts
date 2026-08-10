package socket

import (
	"log/slog"

	"github.com/ellgreen/thoughts/cmd/thoughts/event"
)

type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broker     *event.Broker
}

func NewHub(broker *event.Broker) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broker:     broker,
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			h.connectionInfoSync()
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}

			if len(h.clients) == 0 {
				return
			}

			h.connectionInfoSync()
		case event := <-h.broker.Listen():
			h.broadcast(event.ToJSON())
		case userDependentEvent := <-h.broker.ListenUserDependent():
			for client := range h.clients {
				evt := userDependentEvent(client.user)
				if evt == nil {
					continue
				}

				if !client.Send(evt.ToJSON()) {
					h.drop(client)
				}
			}
		}
	}
}

func (h *Hub) broadcast(data []byte) {
	for client := range h.clients {
		if !client.Send(data) {
			h.drop(client)
		}
	}
}

// drop removes a client whose send buffer has filled up. Its read pump will
// also unregister once the connection tears down; Run's unregister case
// tolerates a client that is already gone.
func (h *Hub) drop(client *Client) {
	slog.Warn("dropping stalled websocket client", "user", client.user.Name)

	delete(h.clients, client)
	close(client.send)
}

func (h *Hub) userNames() []string {
	users := make([]string, 0, len(h.clients))
	for client := range h.clients {
		users = append(users, client.user.Name)
	}

	return users
}

func (h *Hub) connectionInfoSync() {
	h.broadcast(event.NewConnectionInfoEvent(h.userNames()).ToJSON())
}
