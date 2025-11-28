package exporters

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/ellgreen/thoughts/cmd/thoughts/dal"
	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/samber/lo"
)

type Exporter struct {
	db *sqlx.DB
}

func NewExporter(db *sqlx.DB) *Exporter {
	return &Exporter{db: db}
}

func (e *Exporter) ToMarkdown(ctx context.Context, retro *model.Retro) ([]byte, error) {
	notes, tasks, userMap, err := e.fetchData(ctx, retro)
	if err != nil {
		return nil, fmt.Errorf("problem fetching data for export: %w", err)
	}

	var buf bytes.Buffer

	buf.WriteString("# " + retro.Title)
	buf.WriteString("\n\n")

	buf.WriteString("## Tasks")
	buf.WriteString("\n\n")

	for _, task := range tasks {
		complete := " "
		if task.Completed {
			complete = "x"
		}
		buf.WriteString(fmt.Sprintf("- [%s] %s: %s", complete, task.Who, task.What))
		buf.WriteString("\n")
	}

	buf.WriteString("\n")
	buf.WriteString("## Notes")
	buf.WriteString("\n")

	for _, column := range retro.GetColumns() {
		buf.WriteString("\n")
		buf.WriteString("## " + column.Title)
		buf.WriteString("\n\n")
		buf.WriteString(column.Description)
		buf.WriteString("\n")

		for _, note := range lo.Filter(notes, func(note *model.Note, _ int) bool {
			return note.ColumnID == column.ID
		}) {
			author := "Unknown"
			if user, ok := userMap[note.UserID]; ok {
				author = user.Name
			}

			content := strings.TrimSpace(note.Content)
			content = strings.ReplaceAll(content, "\n", "\n> ")

			buf.WriteString("\n> " + content)
			buf.WriteString("\n>\n")
			buf.WriteString("> &mdash; <cite>" + author + "</cite>")
			buf.WriteString("\n")
		}
	}

	return buf.Bytes(), nil
}

func (e *Exporter) fetchData(
	ctx context.Context,
	retro *model.Retro,
) ([]*model.Note, []*model.Task, map[uuid.UUID]*model.User, error) {
	notes, err := dal.NoteList(ctx, e.db, retro.ID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("problem fetching notes: %w", err)
	}

	tasks, err := dal.TaskList(ctx, e.db, retro.ID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("problem fetching tasks: %w", err)
	}

	userMap, err := dal.UserMap(ctx, e.db, lo.Uniq(lo.Map(notes, func(note *model.Note, _ int) uuid.UUID {
		return note.UserID
	})))
	if err != nil {
		return nil, nil, nil, fmt.Errorf("problem fetching note users: %w", err)
	}

	return notes, tasks, userMap, nil
}
