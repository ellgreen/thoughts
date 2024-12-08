package socket

import (
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
			for client := range h.clients {
				client.Send(event.ToJSON())
			}
		case userDependentEvent := <-h.broker.ListenUserDependent():
			for client := range h.clients {
				evt := userDependentEvent(client.user)
				if evt != nil {
					client.Send(evt.ToJSON())
				}
			}
		}
	}
}

func (h *Hub) userNames() []string {
	users := make([]string, 0, len(h.clients))
	for client := range h.clients {
		users = append(users, client.user.Name)
	}

	return users
}

func (h *Hub) connectionInfoSync() {
	data := event.NewConnectionInfoEvent(h.userNames()).ToJSON()

	for client := range h.clients {
		client.Send(data)
	}
}
