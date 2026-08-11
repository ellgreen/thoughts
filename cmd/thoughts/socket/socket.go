package socket

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/ellgreen/thoughts/cmd/thoughts/auth"
	"github.com/ellgreen/thoughts/cmd/thoughts/event"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
)

func NewRetroSocketHandler(db *sqlx.DB, devOrigin string) http.HandlerFunc {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin(devOrigin),
	}

	var hubs sync.Map

	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.UserFromRequest(r)
		if user == nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		retroID, err := uuid.Parse(mux.Vars(r)["id"])
		if err != nil {
			slog.Error("failed to parse retro_id", "error", err)
			http.Error(w, "failed to parse retro_id", http.StatusBadRequest)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("failed to upgrade connection", "error", err)
			return
		}

		hubValue, ok := hubs.Load(retroID)
		if !ok {
			broker := event.NewBroker(db, retroID)
			hubValue = NewHub(broker)
			hubs.Store(retroID, hubValue)
		}

		hub := hubValue.(*Hub)

		if !ok {
			go func() {
				defer hubs.Delete(retroID)

				hub.Run()
			}()
		}

		client := NewClient(hub, conn, user)
		hub.Register(client)

		ctx := context.Background()

		go client.ReadPump(ctx)
		go client.WritePump()
	}
}

// checkOrigin rejects cross-site connections: sessions are cookie based, so
// any origin would let any page a logged-in user visits drive their retros.
// Requests with no Origin are not browsers and are allowed through.
func checkOrigin(devOrigin string) func(*http.Request) bool {
	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}

		originURL, err := url.Parse(origin)
		if err != nil {
			slog.Warn("rejecting websocket with unparseable origin", "origin", origin)
			return false
		}

		if strings.EqualFold(originURL.Host, r.Host) {
			return true
		}

		if devOrigin != "" {
			if devURL, err := url.Parse(devOrigin); err == nil && strings.EqualFold(originURL.Host, devURL.Host) {
				return true
			}
		}

		slog.Warn("rejecting websocket from disallowed origin", "origin", origin, "host", r.Host)

		return false
	}
}
