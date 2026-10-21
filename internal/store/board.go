package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

type GroupRow struct {
	ID       string
	ColumnID string
	Title    string
}

type Note struct {
	ID         string
	GroupID    string
	AuthorID   string
	AuthorName string
	Content    string
	ImgURL     string
	CreatedAt  time.Time
}

type VoteRow struct {
	UserID  string
	GroupID string
	Count   int
}

type Reaction struct {
	NoteID string
	UserID string
	Emoji  string
}

type Action struct {
	ID          string
	What        string
	Who         string
	DueOn       string
	DoneAt      *time.Time
	Closed      string
	CarriedFrom string
}

// Board is everything in a retro, unfiltered. Who may see what is decided
// when it is shown to someone, not here.
type Board struct {
	Retro       Retro
	Groups      []GroupRow
	Notes       []Note
	Votes       []VoteRow
	Reactions   []Reaction
	Actions     []Action
	Suggestions []Suggestion
	// Ready is who has said they're done with the current stage.
	Ready []string
	Team  *Team
	// LastTime is the team's open actions from earlier retros.
	LastTime []OpenAction
}

// Reactions is the fixed set, the same six as v1.
var Reactions = []string{"👍", "🎉", "😂", "😮", "👀", "❤️"}

const MaxNoteLength = 500

func (s *Store) Board(ctx context.Context, retroID string) (Board, error) {
	var b Board
	var err error
	if b.Retro, err = retroIn(ctx, s.db, retroID); err != nil {
		return b, err
	}
	if err := scanAll(ctx, s.db, &b.Groups, `SELECT g.id, g.column_id, g.title FROM groups g
		JOIN columns c ON c.id = g.column_id WHERE g.retro_id = ? ORDER BY c.position, g.created_at, g.id`, []any{retroID},
		func(r *sql.Rows, g *GroupRow) error { return r.Scan(&g.ID, &g.ColumnID, &g.Title) }); err != nil {
		return b, err
	}
	if err := scanAll(ctx, s.db, &b.Notes, `SELECT n.id, n.group_id, n.author_id, u.name, n.content, n.img_url, n.created_at
		FROM notes n JOIN users u ON u.id = n.author_id WHERE n.retro_id = ? ORDER BY n.created_at, n.id`, []any{retroID},
		func(r *sql.Rows, n *Note) error {
			var created string
			if err := r.Scan(&n.ID, &n.GroupID, &n.AuthorID, &n.AuthorName, &n.Content, &n.ImgURL, &created); err != nil {
				return err
			}
			var err error
			n.CreatedAt, err = parseStamp(created)
			return err
		}); err != nil {
		return b, err
	}
	if err := scanAll(ctx, s.db, &b.Votes, `SELECT user_id, group_id, count FROM votes WHERE retro_id = ?`, []any{retroID},
		func(r *sql.Rows, v *VoteRow) error { return r.Scan(&v.UserID, &v.GroupID, &v.Count) }); err != nil {
		return b, err
	}
	if err := scanAll(ctx, s.db, &b.Reactions, `SELECT x.note_id, x.user_id, x.emoji FROM reactions x JOIN notes n ON n.id = x.note_id
		WHERE n.retro_id = ? ORDER BY x.created_at`, []any{retroID},
		func(r *sql.Rows, x *Reaction) error { return r.Scan(&x.NoteID, &x.UserID, &x.Emoji) }); err != nil {
		return b, err
	}
	if b.Actions, err = actionsIn(ctx, s.db, `WHERE retro_id = ? ORDER BY created_at, id`, retroID); err != nil {
		return b, err
	}
	if b.Suggestions, err = suggestionsIn(ctx, s.db, retroID); err != nil {
		return b, err
	}
	if err := scanAll(ctx, s.db, &b.Ready, `SELECT user_id FROM ready WHERE retro_id = ? AND stage = ?`, []any{retroID, b.Retro.Stage},
		func(r *sql.Rows, id *string) error { return r.Scan(id) }); err != nil {
		return b, err
	}
	if b.Retro.TeamID == "" {
		return b, nil
	}
	team, err := teamIn(ctx, s.db, `WHERE id = ?`, b.Retro.TeamID)
	if err != nil {
		return b, err
	}
	b.Team = &team
	b.LastTime, err = s.openActions(ctx, `r.team_id = ? AND `+earlier("r"), b.Retro.TeamID,
		stamp(b.Retro.CreatedAt), stamp(b.Retro.CreatedAt), retroID)
	return b, err
}

func scanAll[T any](ctx context.Context, q querier, dst *[]T, query string, args []any, scan func(*sql.Rows, *T) error) error {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var v T
		if err := scan(rows, &v); err != nil {
			return err
		}
		*dst = append(*dst, v)
	}
	return rows.Err()
}

func (s *Store) AddNote(ctx context.Context, retroID, authorID, columnID, content string) (Note, error) {
	content, err := cleanNote(content)
	if err != nil {
		return Note{}, err
	}
	now := s.now()
	n := Note{ID: newID(now), AuthorID: authorID, Content: content, CreatedAt: now.UTC().Truncate(time.Second)}
	err = s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if r.Stage != Reflect && r.Stage != Group {
			return Problem("Notes can only be added while reflecting or grouping.")
		}
		if !hasColumn(r, columnID) {
			return ErrNotFound
		}
		if n.GroupID, err = newGroup(ctx, tx, retroID, columnID, now); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO notes (id, retro_id, group_id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			n.ID, retroID, n.GroupID, authorID, content, stamp(now), stamp(now))
		return err
	})
	return n, err
}

type NoteEdit struct {
	Content *string
	ImgURL  *string
}

func (s *Store) EditNote(ctx context.Context, retroID, noteID, by string, e NoteEdit) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, n, err := noteIn(ctx, tx, retroID, noteID)
		if err != nil {
			return err
		}
		if n.AuthorID != by {
			return Problem("Only the person who wrote a note can change it.")
		}
		if r.Stage != Reflect && r.Stage != Group {
			return Problem("Notes can only be changed while reflecting or grouping.")
		}
		if e.Content != nil {
			if n.Content, err = cleanNote(*e.Content); err != nil {
				return err
			}
		}
		if e.ImgURL != nil {
			if n.ImgURL, err = cleanImage(*e.ImgURL); err != nil {
				return err
			}
		}
		_, err = tx.ExecContext(ctx, `UPDATE notes SET content = ?, img_url = ?, updated_at = ? WHERE id = ?`, n.Content, n.ImgURL, stamp(s.now()), noteID)
		return err
	})
}

func (s *Store) DeleteNote(ctx context.Context, retroID, noteID, by string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, n, err := noteIn(ctx, tx, retroID, noteID)
		if err != nil {
			return err
		}
		if n.AuthorID != by {
			return Problem("Only the person who wrote a note can remove it.")
		}
		if r.Stage != Reflect && r.Stage != Group {
			return Problem("Notes can only be removed while reflecting or grouping.")
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, noteID); err != nil {
			return err
		}
		return dropIfEmpty(ctx, tx, n.GroupID)
	})
}

// MoveNote puts a note into another group, or into a group of its own in
// columnID when groupID is empty. While reflecting only the author can move
// a note, and only between columns.
func (s *Store) MoveNote(ctx context.Context, retroID, noteID, by, columnID, groupID string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, n, err := noteIn(ctx, tx, retroID, noteID)
		if err != nil {
			return err
		}
		switch r.Stage {
		case Reflect:
			if n.AuthorID != by {
				return Problem("Until grouping starts, only the person who wrote a note can move it.")
			}
			if groupID != "" {
				return Problem("Notes can be grouped once everyone moves on to grouping.")
			}
		case Group:
		default:
			return Problem("Notes stay put once voting starts.")
		}
		if groupID != "" {
			var exists bool
			if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM groups WHERE id = ? AND retro_id = ?)`, groupID, retroID).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				return ErrNotFound
			}
			if groupID == n.GroupID {
				return nil
			}
		} else {
			if !hasColumn(r, columnID) {
				return ErrNotFound
			}
			if groupID, err = newGroup(ctx, tx, retroID, columnID, s.now()); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `UPDATE notes SET group_id = ? WHERE id = ?`, groupID, noteID); err != nil {
			return err
		}
		return leaveGroup(ctx, tx, n.GroupID, groupID)
	})
}

func (s *Store) NameGroup(ctx context.Context, retroID, groupID, title string) error {
	title = strings.TrimSpace(title)
	if utf8.RuneCountInString(title) > 60 {
		return Problem("Keep a group's name under 60 characters.")
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if r.Stage == Reflect {
			return Problem("Groups can be named once grouping starts.")
		}
		res, err := tx.ExecContext(ctx, `UPDATE groups SET title = ? WHERE id = ? AND retro_id = ?`, title, groupID, retroID)
		if err != nil {
			return err
		}
		return mustAffect(res)
	})
}

// CastVote adds delta (1 or -1) to the caller's votes on a group. Votes can
// stack on one group, like dot stickers, up to the retro's limit in total.
func (s *Store) CastVote(ctx context.Context, retroID, groupID, by string, delta int) error {
	if delta != 1 && delta != -1 {
		return Problem("Votes go on or come off one at a time.")
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, err := retroIn(ctx, tx, retroID)
		if err != nil {
			return err
		}
		if r.Stage != Vote {
			return Problem("Voting is closed.")
		}
		var exists bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM groups WHERE id = ? AND retro_id = ?)`, groupID, retroID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		var used, here int
		if err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(count), 0), COALESCE(SUM(CASE WHEN group_id = ? THEN count END), 0)
			FROM votes WHERE retro_id = ? AND user_id = ?`, groupID, retroID, by).Scan(&used, &here); err != nil {
			return err
		}
		switch {
		case delta > 0 && used >= r.MaxVotes:
			return Problem(fmt.Sprintf("You've used all %d votes. Take one back to move it.", r.MaxVotes))
		case delta < 0 && here == 0:
			return nil
		case here+delta == 0:
			_, err = tx.ExecContext(ctx, `DELETE FROM votes WHERE user_id = ? AND group_id = ?`, by, groupID)
		default:
			_, err = tx.ExecContext(ctx, `INSERT INTO votes (retro_id, user_id, group_id, count) VALUES (?, ?, ?, 1)
				ON CONFLICT (user_id, group_id) DO UPDATE SET count = count + ?`, retroID, by, groupID, delta)
		}
		return err
	})
}

func (s *Store) React(ctx context.Context, retroID, noteID, by, emoji string, on bool) error {
	if !slices.Contains(Reactions, emoji) {
		return Problem("That reaction isn't one of the six.")
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		r, _, err := noteIn(ctx, tx, retroID, noteID)
		if err != nil {
			return err
		}
		if r.Stage != Discuss {
			return Problem("Reactions open when discussion starts.")
		}
		if on {
			_, err = tx.ExecContext(ctx, `INSERT INTO reactions (note_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
				noteID, by, emoji, stamp(s.now()))
		} else {
			_, err = tx.ExecContext(ctx, `DELETE FROM reactions WHERE note_id = ? AND user_id = ? AND emoji = ?`, noteID, by, emoji)
		}
		return err
	})
}

type ActionInput struct {
	What  string
	Who   string
	DueOn string
}

func (s *Store) AddAction(ctx context.Context, retroID string, in ActionInput) (Action, error) {
	a, err := cleanAction(in)
	if err != nil {
		return Action{}, err
	}
	now := s.now()
	a.ID = newID(now)
	err = s.inTx(ctx, func(tx *sql.Tx) error {
		if _, err := retroIn(ctx, tx, retroID); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO actions (id, retro_id, what, who, due_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			a.ID, retroID, a.What, a.Who, nullable(a.DueOn), stamp(now), stamp(now))
		return err
	})
	return a, err
}

func (s *Store) UpdateAction(ctx context.Context, retroID, actionID string, in ActionInput) error {
	a, err := cleanAction(in)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `UPDATE actions SET what = ?, who = ?, due_on = ?, updated_at = ? WHERE id = ? AND retro_id = ?`,
		a.What, a.Who, nullable(a.DueOn), stamp(s.now()), actionID, retroID)
	if err != nil {
		return err
	}
	return mustAffect(res)
}

func (s *Store) SetActionDone(ctx context.Context, retroID, actionID string, done bool) error {
	var doneAt any
	if done {
		doneAt = stamp(s.now())
	}
	res, err := s.db.ExecContext(ctx, `UPDATE actions SET done_at = ?, updated_at = ? WHERE id = ? AND retro_id = ?`,
		doneAt, stamp(s.now()), actionID, retroID)
	if err != nil {
		return err
	}
	return mustAffect(res)
}

func (s *Store) DeleteAction(ctx context.Context, retroID, actionID string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM actions WHERE id = ? AND retro_id = ?`, actionID, retroID)
	if err != nil {
		return err
	}
	return mustAffect(res)
}

type OpenAction struct {
	Action
	RetroID    string
	RetroTitle string
}

// OpenActions is every unfinished action on a listed retro with tag.
func (s *Store) OpenActions(ctx context.Context, tag string) ([]OpenAction, error) {
	return s.openActions(ctx, `r.unlisted = 0 AND r.id IN (SELECT retro_id FROM retro_tags WHERE tag = ?)`, tag)
}

func actionsIn(ctx context.Context, q querier, where string, args ...any) ([]Action, error) {
	var out []Action
	err := scanAll(ctx, q, &out, `SELECT id, what, who, COALESCE(due_on, ''), done_at, COALESCE(closed, ''), COALESCE(carried_from, '') FROM actions `+where, args,
		func(r *sql.Rows, a *Action) error {
			var done sql.NullString
			if err := r.Scan(&a.ID, &a.What, &a.Who, &a.DueOn, &done, &a.Closed, &a.CarriedFrom); err != nil {
				return err
			}
			if done.Valid {
				t, err := parseStamp(done.String)
				if err != nil {
					return err
				}
				a.DoneAt = &t
			}
			return nil
		})
	return out, err
}

func noteIn(ctx context.Context, tx *sql.Tx, retroID, noteID string) (Retro, Note, error) {
	r, err := retroIn(ctx, tx, retroID)
	if err != nil {
		return r, Note{}, err
	}
	var n Note
	err = tx.QueryRowContext(ctx, `SELECT id, group_id, author_id, content, img_url FROM notes WHERE id = ? AND retro_id = ?`, noteID, retroID).
		Scan(&n.ID, &n.GroupID, &n.AuthorID, &n.Content, &n.ImgURL)
	if errors.Is(err, sql.ErrNoRows) {
		return r, n, ErrNotFound
	}
	return r, n, err
}

func newGroup(ctx context.Context, tx *sql.Tx, retroID, columnID string, now time.Time) (string, error) {
	id := newID(now)
	_, err := tx.ExecContext(ctx, `INSERT INTO groups (id, retro_id, column_id, created_at) VALUES (?, ?, ?, ?)`, id, retroID, columnID, stamp(now))
	return id, err
}

// leaveGroup drops a group its last note has just left for another. Its
// votes go with that note, which matters once grouping is reopened after
// voting: deleting the group would cascade them away.
func leaveGroup(ctx context.Context, tx *sql.Tx, from, to string) error {
	var empty bool
	if err := tx.QueryRowContext(ctx, `SELECT NOT EXISTS (SELECT 1 FROM notes WHERE group_id = ?)`, from).Scan(&empty); err != nil || !empty {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO votes (retro_id, user_id, group_id, count)
		SELECT retro_id, user_id, ?, count FROM votes WHERE group_id = ?
		ON CONFLICT (user_id, group_id) DO UPDATE SET count = count + excluded.count`, to, from); err != nil {
		return err
	}
	return dropIfEmpty(ctx, tx, from)
}

func dropIfEmpty(ctx context.Context, tx *sql.Tx, groupID string) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM groups WHERE id = ? AND NOT EXISTS (SELECT 1 FROM notes WHERE group_id = ?)`, groupID, groupID)
	return err
}

func hasColumn(r Retro, columnID string) bool {
	return slices.ContainsFunc(r.Columns, func(c Column) bool { return c.ID == columnID })
}

func cleanNote(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", Problem("Write something first.")
	}
	if utf8.RuneCountInString(s) > MaxNoteLength {
		return "", Problem(fmt.Sprintf("Keep a note under %d characters. Split it into two if you need to.", MaxNoteLength))
	}
	return s, nil
}

func cleanImage(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", nil
	}
	u, err := url.Parse(s)
	if err != nil || u.Scheme != "https" || u.Host == "" || len(s) > 2048 {
		return "", Problem("Images need an https:// link.")
	}
	return s, nil
}

func cleanAction(in ActionInput) (Action, error) {
	what, err := cleanText(in.What, "Say what's going to happen.", 2, 300)
	if err != nil {
		return Action{}, err
	}
	who := strings.TrimSpace(in.Who)
	if utf8.RuneCountInString(who) > 60 {
		return Action{}, Problem("Keep who's doing it under 60 characters.")
	}
	due := strings.TrimSpace(in.DueOn)
	if due != "" {
		if _, err := time.Parse(time.DateOnly, due); err != nil {
			return Action{}, Problem("That date isn't one we can read.")
		}
	}
	return Action{What: what, Who: who, DueOn: due}, nil
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
