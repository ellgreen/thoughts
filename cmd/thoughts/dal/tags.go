package dal

import (
	"context"
	"fmt"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

func RetroTagsList(ctx context.Context, db *sqlx.DB, retroID uuid.UUID) ([]string, error) {
	tags := make([]string, 0)
	if err := db.SelectContext(ctx, &tags, "select tag from retro_tags where retro_id = ? order by tag", retroID); err != nil {
		return nil, fmt.Errorf("%w: failed to list tags for retro: %w", ErrExecution, err)
	}
	return tags, nil
}

// RetroTagsSet replaces all tags for a retro atomically.
func RetroTagsSet(ctx context.Context, db *sqlx.DB, retroID uuid.UUID, tags []string) error {
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("%w: failed to begin transaction: %w", ErrExecution, err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "delete from retro_tags where retro_id = ?", retroID); err != nil {
		return fmt.Errorf("%w: failed to delete tags: %w", ErrExecution, err)
	}

	for _, tag := range tags {
		if _, err := tx.ExecContext(ctx, "insert into retro_tags (retro_id, tag) values (?, ?)", retroID, tag); err != nil {
			return fmt.Errorf("%w: failed to insert tag: %w", ErrExecution, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("%w: failed to commit tags: %w", ErrExecution, err)
	}
	return nil
}

// TagSuggestions returns tags only from listed retros, ordered by frequency.
func TagSuggestions(ctx context.Context, db *sqlx.DB) ([]string, error) {
	tags := make([]string, 0)
	err := db.SelectContext(ctx, &tags, `
		select rt.tag
		from retro_tags rt
		join retros r on r.id = rt.retro_id
		where r.unlisted = false
		group by rt.tag
		order by count(*) desc, rt.tag asc
		limit 100
	`)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch tag suggestions: %w", ErrExecution, err)
	}
	return tags, nil
}

type TagStats struct {
	RetroCount    int `db:"retro_count"    json:"retro_count"`
	NoteCount     int `db:"note_count"     json:"note_count"`
	OpenTaskCount int `db:"open_task_count" json:"open_task_count"`
}

// TagGetStats returns aggregate stats for all listed retros with a given tag.
func TagGetStats(ctx context.Context, db *sqlx.DB, tag string) (*TagStats, error) {
	stats := &TagStats{}
	err := db.GetContext(ctx, stats, `
		select
			count(distinct r.id) as retro_count,
			count(distinct n.id) as note_count,
			count(distinct case when t.completed = 0 then t.id end) as open_task_count
		from retro_tags rt
		join retros r on r.id = rt.retro_id and r.unlisted = false
		left join notes n on n.retro_id = r.id
		left join tasks t on t.retro_id = r.id
		where rt.tag = ?
	`, tag)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to get tag stats: %w", ErrExecution, err)
	}
	return stats, nil
}

// RetrosByTag returns listed retros with a given tag, with counts, newest first.
func RetrosByTag(ctx context.Context, db *sqlx.DB, tag string) ([]*model.Retro, error) {
	retros := make([]*model.Retro, 0)
	err := db.SelectContext(ctx, &retros, `
		select
			r.*,
			count(distinct n.id) as note_count,
			count(distinct t.id) as task_count,
			count(distinct case when t.completed = 1 then t.id end) as task_completed_count
		from retro_tags rt
		join retros r on r.id = rt.retro_id and r.unlisted = false
		left join notes n on n.retro_id = r.id
		left join tasks t on t.retro_id = r.id
		where rt.tag = ?
		group by r.id
		order by r.created_at desc
	`, tag)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch retros by tag: %w", ErrExecution, err)
	}
	return retros, nil
}

// OpenTask extends a task with its retro title for display on the tag page.
type OpenTask struct {
	model.Task
	RetroTitle string `db:"retro_title"`
}

// TagOpenTasks returns all incomplete tasks across listed retros with the given tag.
func TagOpenTasks(ctx context.Context, db *sqlx.DB, tag string) ([]*OpenTask, error) {
	tasks := make([]*OpenTask, 0)
	err := db.SelectContext(ctx, &tasks, `
		select t.*, r.title as retro_title
		from tasks t
		join retros r on r.id = t.retro_id and r.unlisted = false
		join retro_tags rt on rt.retro_id = r.id and rt.tag = ?
		where t.completed = false
		order by t."when" asc
	`, tag)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch open tasks for tag: %w", ErrExecution, err)
	}
	return tasks, nil
}
