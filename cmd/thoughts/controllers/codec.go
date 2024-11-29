package controllers

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Add("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("problem encoding response", "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
