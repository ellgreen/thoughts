package controllers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/exporters"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	"github.com/samber/lo"
)

func RetroGet(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(mux.Vars(r)["id"])
		if err != nil {
			slog.Error("problem parsing id", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		retro, err := dal.RetroGet(r.Context(), db, id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				w.WriteHeader(http.StatusNotFound)
				return
			}

			slog.Error("problem fetching retro", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, resources.RetroFromModel(retro))
	})
}

func RetroIndex(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retros, err := dal.RetroList(r.Context(), db, false)
		if err != nil {
			slog.Error("problem fetching retros", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		writeJSON(w, lo.Map(retros, func(item *model.Retro, _ int) *resources.Retro {
			return resources.RetroFromModel(item)
		}))
	})
}

type RetroCreateRequest struct {
	Title   string `json:"title" validate:"required,min=5,max=255"`
	Columns []struct {
		Title       string `json:"title" validate:"required,min=2,max=255"`
		Description string `json:"description" validate:"max=255"`
	} `json:"columns" validate:"required,min=2,dive,required"`
	Unlisted bool `json:"unlisted"`
}

func RetroCreate(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, ok := requests.From[RetroCreateRequest](w, r)
		if !ok {
			return
		}

		cols := make([]*model.RetroColumn, len(req.Columns))
		for i, col := range req.Columns {
			cols[i] = &model.RetroColumn{
				Title:       col.Title,
				Description: col.Description,
			}
		}

		retro, err := dal.RetroInsert(r.Context(), db, req.Title, cols, req.Unlisted)
		if err != nil {
			slog.Error("problem creating retro", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		writeJSON(w, resources.RetroFromModel(retro))
	})
}

func RetroMarkdown(db *sqlx.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(mux.Vars(r)["id"])
		if err != nil {
			slog.Error("problem parsing id", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		retro, err := dal.RetroGet(r.Context(), db, id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				w.WriteHeader(http.StatusNotFound)
				return
			}

			slog.Error("problem fetching retro", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		markdown, err := exporters.NewExporter(db).ToMarkdown(r.Context(), retro)
		if err != nil {
			slog.Error("problem exporting to markdown", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		w.Header().Add("Content-Type", "text/markdown; charset=utf-8")
		w.Write(markdown)
	})
}

func writeMarkdown(w http.ResponseWriter, data any) {
	w.Header().Add("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("problem encoding response", "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
