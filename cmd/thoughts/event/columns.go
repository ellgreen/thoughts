package event

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/requests"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

const (
	// Matches the create validator in controllers/retros.go. The upper bound
	// also keeps the board grid within the widths it has classes for.
	minColumns = 2
	maxColumns = 5
)

// Columns live as a JSON blob on the retro rather than in their own table, and
// requests.FromMap cannot decode nested structs, so each event carries one
// column at a time.
type (
	columnCreateRequest struct {
		Title       string `json:"title" validate:"required,min=2,max=255"`
		Description string `json:"description" validate:"max=255"`
	}

	columnUpdateRequest struct {
		ColumnID    uuid.UUID `json:"id" validate:"required,uuid"`
		Title       string    `json:"title" validate:"required,min=2,max=255"`
		Description string    `json:"description" validate:"max=255"`
	}

	columnDeleteRequest struct {
		ColumnID uuid.UUID `json:"id" validate:"required,uuid"`
	}
)

func (b *Broker) handleColumnCreate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, _ *model.User, payload Payload) error {
		req, err := requests.FromMap[columnCreateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		retro, err := b.mutateColumns(ctx, db, retroID,
			func(columns model.RetroColumns) (model.RetroColumns, error) {
				if len(columns) >= maxColumns {
					return nil, newErrorEvent(fmt.Sprintf("a retro can have at most %d columns", maxColumns))
				}

				column := &model.RetroColumn{
					ID:          uuid.New(),
					Title:       req.Title,
					Description: req.Description,
				}

				return append(columns, column), nil
			})

		if err != nil {
			return err
		}

		b.dispatch(newRetroUpdatedEvent(retro))

		return nil
	}
}

func (b *Broker) handleColumnUpdate(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, _ *model.User, payload Payload) error {
		req, err := requests.FromMap[columnUpdateRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		retro, err := b.mutateColumns(ctx, db, retroID,
			func(columns model.RetroColumns) (model.RetroColumns, error) {
				column := columns.Find(req.ColumnID)
				if column == nil {
					return nil, newErrorEvent("column not found")
				}

				column.Title = req.Title
				column.Description = req.Description

				return columns, nil
			})

		if err != nil {
			return err
		}

		b.dispatch(newRetroUpdatedEvent(retro))

		return nil
	}
}

func (b *Broker) handleColumnDelete(db *sqlx.DB, retroID uuid.UUID) Handler {
	return func(ctx context.Context, _ *model.User, payload Payload) error {
		req, err := requests.FromMap[columnDeleteRequest](payload)
		if err != nil {
			return newErrorEvent(err.Error())
		}

		retro, err := b.mutateColumns(ctx, db, retroID,
			func(columns model.RetroColumns) (model.RetroColumns, error) {
				if columns.Find(req.ColumnID) == nil {
					return nil, newErrorEvent("column not found")
				}

				if len(columns) <= minColumns {
					return nil, newErrorEvent(fmt.Sprintf("a retro must have at least %d columns", minColumns))
				}

				// Deleting an empty column strands nothing: no notes means no
				// groups, and no groups means no votes.
				count, err := dal.NoteCountForColumn(ctx, db, retroID, req.ColumnID)
				if err != nil {
					slog.Error("problem counting notes for column", "error", err)
					return nil, newErrorEvent("problem checking the column")
				}

				if count > 0 {
					return nil, newErrorEvent("cannot delete a column that contains notes")
				}

				return columns.Without(req.ColumnID), nil
			})

		if err != nil {
			return err
		}

		b.dispatch(newRetroUpdatedEvent(retro))

		return nil
	}
}

// mutateColumns serialises the read-modify-write of the columns blob against
// other column changes and against note creation.
//
// A transaction is the wrong tool here: sqlx issues a deferred BEGIN, so under
// WAL a concurrent writer fails with SQLITE_BUSY_SNAPSHOT rather than
// serialising. There is exactly one broker per retro and the app is single
// process, so a mutex is both sufficient and simpler.
//
// The caller broadcasts after this returns - dispatch reaches a client's write
// pump, and holding the lock across it would let one wedged client block every
// column change in the retro.
func (b *Broker) mutateColumns(
	ctx context.Context,
	db *sqlx.DB,
	retroID uuid.UUID,
	mutate func(columns model.RetroColumns) (model.RetroColumns, error),
) (*model.Retro, error) {
	b.columnsMu.Lock()
	defer b.columnsMu.Unlock()

	retro, err := dal.RetroGet(ctx, db, retroID)
	if err != nil {
		slog.Error("problem getting retro", "error", err)
		return nil, newErrorEvent("problem getting retro")
	}

	columns, err := mutate(retro.GetColumns())
	if err != nil {
		return nil, err
	}

	if err := dal.RetroSetColumns(ctx, db, retro, columns); err != nil {
		slog.Error("problem updating columns", "error", err)
		return nil, newErrorEvent("problem updating columns")
	}

	return retro, nil
}
