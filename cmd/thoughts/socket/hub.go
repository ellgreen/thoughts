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
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}

			if len(h.clients) == 0 {
				return
			}
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
