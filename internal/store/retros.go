package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

// Problem is a rule the caller broke, worded for the person who broke it.
type Problem string

func (p Problem) Error() string { return string(p) }

type Stage string

const (
	Reflect Stage = "reflect"
	Group   Stage = "group"
	Vote    Stage = "vote"
	Discuss Stage = "discuss"
)

var stages = []Stage{Reflect, Group, Vote, Discuss}

func (s Stage) index() int { return slices.Index(stages, s) }

const (
	MinColumns   = 2
	MaxColumns   = 5
	MaxTags      = 10
	MaxVotesCap  = 15
	DefaultVotes = 5
)

type Retro struct {
	ID        string
	Title     string
	Stage     Stage
	MaxVotes  int
	Unlisted  bool
	Recap     string
	TeamID    string
	Timer     Timer
	Spotlight string
	CreatedAt time.Time
	Tags      []string
	Columns   []Column
}

// Timer is running when EndsAt is set, paused when Left is above zero, and
// off otherwise.
type Timer struct {
	EndsAt *time.Time
	Left   int
}

type Column struct {
	ID          string
	Title       string
	Description string
}

type ColumnInput struct {
	Title       string
	Description string
}

type NewRetro struct {
	Title    string
	Columns  []ColumnInput
	Tags     []string
	Unlisted bool
	TeamID   string
}

type RetroSettings struct {
	Title    string
	MaxVotes int
	Unlisted bool
	Tags     []string
	TeamID   string
}

func (s *Store) CreateRetro(ctx context.Context, by string, in NewRetro) (Retro, error) {
	title, err := cleanText(in.Title, "Give the retro a title.", 3, 120)
	if err != nil {
		return Retro{}, err
	}
	if len(in.Columns) < MinColumns || len(in.Columns) > MaxColumns {
		return Retro{}, Problem(fmt.Sprintf("A retro needs %d to %d columns.", MinColumns, MaxColumns))
	}
	tags, err := cleanTags(in.Tags)
	if err != nil {
		return Retro{}, err
	}
	now := s.now()
	r := Retro{ID: newID(now), Title: title, Stage: Reflect, MaxVotes: DefaultVotes, Unlisted: in.Unlisted, TeamID: in.TeamID, CreatedAt: now.UTC().Truncate(time.Second), Tags: tags}
	err = s.inTx(ctx, func(tx *sql.Tx) error {
		if err := teamExists(ctx, tx, in.TeamID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO retros (id, title, stage, max_votes, unlisted, team_id, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, r.ID, r.Title, r.Stage, r.MaxVotes, r.Unlisted, nullable(in.TeamID), by, stamp(now), stamp(now)); err != nil {
			return err
		}
		for i, c := range in.Columns {
			col, err := cleanColumn(c)
			if err != nil {
				return err
			}
			col.ID = newID(now)
			if _, err := tx.ExecContext(ctx, `INSERT INTO columns (id, retro_id, position, title, description) VALUES (?, ?, ?, ?, ?)`,
				col.ID, r.ID, i, col.Title, col.Description); err != nil {
				return err
			}
			r.Columns = append(r.Columns, col)
		}
		return replaceTags(ctx, tx, r.ID, tags)
	})
	return r, err
}

func (s *Store) Retro(ctx context.Context, id string) (Retro, error) {
	return retroIn(ctx, s.db, id)
}

type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

const retroFields = `r.id, r.title, r.stage, r.max_votes, r.unlisted, r.recap, COALESCE(r.team_id, ''), r.timer_ends_at, r.timer_left,
	COALESCE(r.spotlight_group_id, ''), r.created_at`

func scanRetro(row interface{ Scan(...any) error }, r *Retro, extra ...any) error {
	var created string
	var ends sql.NullString
	var left sql.NullInt64
	dst := append([]any{&r.ID, &r.Title, &r.Stage, &r.MaxVotes, &r.Unlisted, &r.Recap, &r.TeamID, &ends, &left, &r.Spotlight, &created}, extra...)
	if err := row.Scan(dst...); err != nil {
		return err
	}
	var err error
	if r.CreatedAt, err = parseStamp(created); err != nil {
		return err
	}
	if ends.Valid {
		t, err := parseStamp(ends.String)
		if err != nil {
			return err
		}
		r.Timer.EndsAt = &t
	}
	r.Timer.Left = int(left.Int64)
	return nil
}

func retroIn(ctx context.Context, q querier, id string) (Retro, error) {
	var r Retro
	err := scanRetro(q.QueryRowContext(ctx, `SELECT `+retroFields+` FROM retros r WHERE r.id = ?`, id), &r)
	if errors.Is(err, sql.ErrNoRows) {
		return Retro{}, ErrNotFound
	}
	if err != nil {
		return Retro{}, err
	}
	if r.Columns, err = columnsIn(ctx, q, id); err != nil {
		return Retro{}, err
	}
	r.Tags, err = tagsIn(ctx, q, id)
	return r, err
}

func columnsIn(ctx context.Context, q querier, retroID string) ([]Column, error) {
	rows, err := q.QueryContext(ctx, `SELECT id, title, description FROM columns WHERE retro_id = ? ORDER BY position`, retroID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Column
	for rows.Next() {
		var c Column
		if err := rows.Scan(&c.ID, &c.Title, &c.Description); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func tagsIn(ctx context.Context, q querier, retroID string) ([]string, error) {
	rows, err := q.QueryContext(ctx, `SELECT tag FROM retro_tags WHERE retro_id = ? ORDER BY tag`, retroID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) UpdateRetro(ctx context.Context, id string, in RetroSettings) error {
	title, err := cleanText(in.Title, "Give the retro a title.", 3, 120)
	if err != nil {
		return err
	}
	if in.MaxVotes < 1 || in.MaxVotes > MaxVotesCap {
		return Problem(fmt.Sprintf("Votes per person can be 1 to %d.", MaxVotesCap))
	}
	tags, err := cleanTags(in.Tags)
	if err != nil {
		return err
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		if err := teamExists(ctx, tx, in.TeamID); err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `UPDATE retros SET title = ?, max_votes = ?, unlisted = ?, team_id = ?, updated_at = ? WHERE id = ?`,
			title, in.MaxVotes, in.Unlisted, nullable(in.TeamID), stamp(s.now()), id)
		if err != nil {
			return err
		}
		if err := mustAffect(res); err != nil {
			return err
		}
		return replaceTags(ctx, tx, id, tags)
	})
}

// SetStage moves one step at a time, as v1 did, so a slip of the keyboard
// can't jump the room from writing straight to discussing.
func (s *Store) SetStage(ctx context.Context, id string, to Stage) error {
	if to.index() < 0 {
		return Problem("That isn't a stage.")
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, id)
		if err != nil {
			return err
		}
		if d := to.index() - r.Stage.index(); d != 1 && d != -1 {
			return Problem("Stages move one step at a time.")
		}
		_, err = tx.ExecContext(ctx, `UPDATE retros SET stage = ?, updated_at = ? WHERE id = ?`, to, stamp(s.now()), id)
		return err
	})
}

func (s *Store) AddColumn(ctx context.Context, retroID string, in ColumnInput) (Column, error) {
	col, err := cleanColumn(in)
	if err != nil {
		return Column{}, err
	}
	col.ID = newID(s.now())
	err = s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if len(r.Columns) >= MaxColumns {
			return Problem(fmt.Sprintf("A retro can have up to %d columns.", MaxColumns))
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO columns (id, retro_id, position, title, description)
			VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM columns WHERE retro_id = ?), ?, ?)`,
			col.ID, retroID, retroID, col.Title, col.Description)
		return err
	})
	return col, err
}

func (s *Store) UpdateColumn(ctx context.Context, retroID, columnID string, in ColumnInput) error {
	col, err := cleanColumn(in)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `UPDATE columns SET title = ?, description = ? WHERE id = ? AND retro_id = ?`,
		col.Title, col.Description, columnID, retroID)
	if err != nil {
		return err
	}
	return mustAffect(res)
}

func (s *Store) DeleteColumn(ctx context.Context, retroID, columnID string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if !slices.ContainsFunc(r.Columns, func(c Column) bool { return c.ID == columnID }) {
			return ErrNotFound
		}
		if len(r.Columns) <= MinColumns {
			return Problem(fmt.Sprintf("A retro needs at least %d columns.", MinColumns))
		}
		var notes int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM notes n JOIN groups g ON g.id = n.group_id WHERE g.column_id = ?`, columnID).Scan(&notes); err != nil {
			return err
		}
		if notes > 0 {
			return Problem("Only an empty column can be removed. Move its notes out first.")
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM columns WHERE id = ?`, columnID)
		return err
	})
}

type RetroSummary struct {
	Retro
	Notes       int
	Actions     int
	ActionsDone int
}

// ListRetros is the newest listed retros, or every listed retro with tag
// when tag isn't empty.
func (s *Store) ListRetros(ctx context.Context, tag string, limit int) ([]RetroSummary, error) {
	if tag != "" {
		return s.listRetros(ctx, `r.id IN (SELECT retro_id FROM retro_tags WHERE tag = ?)`, []any{tag}, limit)
	}
	return s.listRetros(ctx, `1 = 1`, nil, limit)
}

func (s *Store) listRetros(ctx context.Context, where string, args []any, limit int) ([]RetroSummary, error) {
	var out []RetroSummary
	err := scanAll(ctx, s.db, &out, `SELECT `+retroFields+`,
		(SELECT COUNT(*) FROM notes n WHERE n.retro_id = r.id),
		(SELECT COUNT(*) FROM actions a WHERE a.retro_id = r.id),
		(SELECT COUNT(*) FROM actions a WHERE a.retro_id = r.id AND a.done_at IS NOT NULL)
		FROM retros r WHERE r.unlisted = 0 AND `+where+` ORDER BY r.created_at DESC, r.id DESC LIMIT ?`, append(args, limit),
		func(r *sql.Rows, sum *RetroSummary) error {
			return scanRetro(r, &sum.Retro, &sum.Notes, &sum.Actions, &sum.ActionsDone)
		})
	if err != nil || len(out) == 0 {
		return out, err
	}

	ids := make([]any, len(out))
	for i := range out {
		ids[i] = out[i].ID
	}
	in := "(?" + strings.Repeat(", ?", len(ids)-1) + ")"
	type column struct {
		retroID string
		Column
	}
	var columns []column
	if err := scanAll(ctx, s.db, &columns, `SELECT retro_id, id, title, description FROM columns WHERE retro_id IN `+in+` ORDER BY position`, ids,
		func(r *sql.Rows, c *column) error { return r.Scan(&c.retroID, &c.ID, &c.Title, &c.Description) }); err != nil {
		return nil, err
	}
	var tags [][2]string
	if err := scanAll(ctx, s.db, &tags, `SELECT retro_id, tag FROM retro_tags WHERE retro_id IN `+in+` ORDER BY tag`, ids,
		func(r *sql.Rows, t *[2]string) error { return r.Scan(&t[0], &t[1]) }); err != nil {
		return nil, err
	}
	byID := map[string]*Retro{}
	for i := range out {
		out[i].Tags = []string{}
		byID[out[i].ID] = &out[i].Retro
	}
	for _, c := range columns {
		byID[c.retroID].Columns = append(byID[c.retroID].Columns, c.Column)
	}
	for _, t := range tags {
		byID[t[0]].Tags = append(byID[t[0]].Tags, t[1])
	}
	return out, nil
}

// Tags is every tag on a listed retro, most used first.
func (s *Store) Tags(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT t.tag FROM retro_tags t JOIN retros r ON r.id = t.retro_id
		WHERE r.unlisted = 0 GROUP BY t.tag ORDER BY COUNT(*) DESC, t.tag LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func replaceTags(ctx context.Context, tx *sql.Tx, retroID string, tags []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM retro_tags WHERE retro_id = ?`, retroID); err != nil {
		return err
	}
	for _, t := range tags {
		if _, err := tx.ExecContext(ctx, `INSERT INTO retro_tags (retro_id, tag) VALUES (?, ?)`, retroID, t); err != nil {
			return err
		}
	}
	return nil
}

func cleanColumn(in ColumnInput) (Column, error) {
	title, err := cleanText(in.Title, "Give the column a title.", 1, 60)
	if err != nil {
		return Column{}, err
	}
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > 200 {
		return Column{}, Problem("Keep the column's prompt under 200 characters.")
	}
	return Column{Title: title, Description: desc}, nil
}

// CleanTag lowercases a tag and joins its words with hyphens, as v1 did.
func CleanTag(t string) string {
	return strings.Join(strings.Fields(strings.ToLower(t)), "-")
}

func cleanTags(in []string) ([]string, error) {
	out := []string{}
	for _, t := range in {
		t = CleanTag(t)
		if t == "" || slices.Contains(out, t) {
			continue
		}
		if utf8.RuneCountInString(t) > 50 {
			return nil, Problem("Keep each tag under 50 characters.")
		}
		out = append(out, t)
	}
	if len(out) > MaxTags {
		return nil, Problem(fmt.Sprintf("A retro can have up to %d tags.", MaxTags))
	}
	slices.Sort(out)
	return out, nil
}

func cleanText(s, empty string, minLen, maxLen int) (string, error) {
	s = strings.TrimSpace(s)
	n := utf8.RuneCountInString(s)
	switch {
	case n == 0:
		return "", Problem(empty)
	case n < minLen:
		return "", Problem(fmt.Sprintf("Use at least %d characters.", minLen))
	case n > maxLen:
		return "", Problem(fmt.Sprintf("Keep it under %d characters.", maxLen))
	}
	return s, nil
}

func mustAffect(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
