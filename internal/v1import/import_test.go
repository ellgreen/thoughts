package v1import

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/ellgreen/thoughts/internal/db"
	"github.com/ellgreen/thoughts/internal/store"
	"github.com/ellgreen/thoughts/migrations"
)

// The fixtures are databases written by real v1 releases (0.3.0, before
// tags, images, vote limits, task completion and reactions, and 1.2.1, the
// last), driven through v1's own API with the same retro in each.
type fixture struct {
	PriyaCookie string `json:"priyaCookie"`
	PriyaID     string `json:"priyaId"`
	Done        string `json:"done"`
	Grouping    string `json:"grouping"`
	Fresh       string `json:"fresh"`
}

func open(t *testing.T, version string) (*sql.DB, string, fixture) {
	t.Helper()
	dir := t.TempDir()
	for _, f := range []string{"thoughts.sqlite", "session.key"} {
		b, err := os.ReadFile(filepath.Join("testdata", version, f))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, f), b, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	var fx fixture
	raw, _ := os.ReadFile(filepath.Join("testdata", version, "fixture.json"))
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "thoughts.sqlite")
	d, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d, path, fx
}

func TestImport(t *testing.T) {
	for _, version := range []string{"0.3.0", "1.2.1"} {
		t.Run(version, func(t *testing.T) {
			ctx := context.Background()
			d, path, fx := open(t, version)
			if v1, err := db.IsV1(ctx, d); err != nil || !v1 {
				t.Fatalf("not seen as v1: %v %v", v1, err)
			}

			backup, err := Backup(ctx, d, path, time.Date(2026, 10, 21, 9, 0, 0, 0, time.UTC))
			if err != nil || !strings.HasSuffix(backup, "thoughts.v1-backup-20261021-090000.sqlite") {
				t.Fatalf("backup = %q, %v", backup, err)
			}
			sum, err := Import(ctx, d, migrations.FS)
			if err != nil {
				t.Fatal(err)
			}
			modern := version == "1.2.1"
			if sum.Users != 5 || sum.Retros != 3 || sum.Notes != 9 || sum.Votes != 6 || sum.Actions != 2 {
				t.Fatalf("summary = %+v", sum)
			}
			if modern && (sum.Reactions != 3 || sum.Tags != 3) {
				t.Fatalf("summary = %+v", sum)
			}

			if v1, _ := db.IsV1(ctx, d); v1 {
				t.Fatal("still looks like v1")
			}
			if err := db.Migrate(ctx, d, migrations.FS); err != nil {
				t.Fatalf("v2 migrate after import: %v", err)
			}
			var leftovers int
			_ = d.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE name LIKE 'v1\_%' ESCAPE '\' OR name = 'goose_db_version'`).Scan(&leftovers)
			if leftovers != 0 {
				t.Fatalf("%d v1 tables left behind", leftovers)
			}

			s := store.New(d)
			b, err := s.Board(ctx, fx.Done)
			if err != nil {
				t.Fatal(err)
			}
			if b.Retro.Stage != store.Discuss || b.Retro.Title != "Sprint 41 retro" || len(b.Retro.Columns) != 3 {
				t.Fatalf("retro = %+v", b.Retro)
			}
			if b.Retro.CreatedAt.Year() != 2026 {
				t.Fatalf("created at %v", b.Retro.CreatedAt)
			}
			if len(b.Notes) != 6 || len(b.Groups) != 4 {
				t.Fatalf("%d notes in %d groups", len(b.Notes), len(b.Groups))
			}
			var checkout string
			for _, n := range b.Notes {
				if strings.HasPrefix(n.Content, "The checkout") {
					checkout = n.GroupID
				}
			}
			var inGroup, votes int
			for _, n := range b.Notes {
				if n.GroupID == checkout {
					inGroup++
				}
			}
			for _, v := range b.Votes {
				if v.GroupID == checkout {
					votes += v.Count
				}
			}
			if inGroup != 3 || votes != 3 {
				t.Fatalf("checkout group has %d notes and %d votes", inGroup, votes)
			}
			if b.Actions[0].DueOn != "2026-10-31" || b.Actions[0].Who != "Sam" {
				t.Fatalf("action = %+v", b.Actions[0])
			}
			if modern {
				if b.Actions[1].DoneAt == nil || len(b.Reactions) != 3 || len(b.Retro.Tags) != 2 {
					t.Fatalf("done = %v reactions = %d tags = %v", b.Actions[1].DoneAt, len(b.Reactions), b.Retro.Tags)
				}
			}

			fresh, _ := s.Retro(ctx, fx.Fresh)
			grouping, _ := s.Retro(ctx, fx.Grouping)
			if fresh.Stage != store.Reflect || grouping.Stage != store.Group || fresh.Unlisted != modern {
				t.Fatalf("fresh = %+v grouping = %+v", fresh, grouping)
			}

			listed, _ := s.ListRetros(ctx, "", 30)
			if want := map[bool]int{true: 2, false: 3}[modern]; len(listed) != want {
				t.Fatalf("%d listed retros", len(listed))
			}

			// The imported database carries on working as a v2 one.
			if err := s.SetStage(ctx, fx.Grouping, store.Vote); err != nil {
				t.Fatal(err)
			}

			sessions, err := LoadSessions(filepath.Join(filepath.Dir(path), "session.key"))
			if err != nil {
				t.Fatal(err)
			}
			if id, ok := sessions.UserID(fx.PriyaCookie); !ok || id != fx.PriyaID {
				t.Fatalf("cookie gave %q, %v", id, ok)
			}
			if _, ok := sessions.UserID(fx.PriyaCookie + "x"); ok {
				t.Fatal("a tampered cookie was accepted")
			}
		})
	}
}

func TestFailedImportChangesNothing(t *testing.T) {
	ctx := context.Background()
	d, _, _ := open(t, "1.2.1")
	if _, err := d.Exec(`UPDATE notes SET created_at = 'yesterday-ish' WHERE rowid = (SELECT MIN(rowid) FROM notes)`); err != nil {
		t.Fatal(err)
	}
	if _, err := Import(ctx, d, migrations.FS); err == nil || !strings.Contains(err.Error(), "yesterday-ish") {
		t.Fatalf("err = %v", err)
	}
	if v1, _ := db.IsV1(ctx, d); !v1 {
		t.Fatal("a failed import left a half-converted database")
	}
	var notes int
	if err := d.QueryRow(`SELECT COUNT(*) FROM notes`).Scan(&notes); err != nil || notes != 9 {
		t.Fatalf("v1 notes = %d, %v", notes, err)
	}
}

func TestOrphansAreLeftOutAndCounted(t *testing.T) {
	ctx := context.Background()
	d, _, _ := open(t, "1.2.1")
	// v1 never enforced foreign keys, so real databases have rows like these.
	for _, q := range []string{
		`DELETE FROM users WHERE name = 'Jo'`,
		`INSERT INTO votes (id, retro_id, user_id, group_id, created_at, updated_at)
			SELECT 'orphan-vote', retro_id, user_id, 'gone-group', created_at, updated_at FROM votes LIMIT 1`,
	} {
		if _, err := d.Exec(`PRAGMA foreign_keys = OFF`); err != nil {
			t.Fatal(err)
		}
		if _, err := d.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := d.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatal(err)
	}
	sum, err := Import(ctx, d, migrations.FS)
	if err != nil {
		t.Fatal(err)
	}
	if sum.Notes != 9 || sum.Dropped["note authors (shown as Someone)"] != 2 || sum.Dropped["votes on deleted groups or from deleted users"] != 3 {
		t.Fatalf("summary = %s", sum)
	}
	var someone string
	_ = d.QueryRow(`SELECT u.name FROM notes n JOIN users u ON u.id = n.author_id WHERE n.content LIKE 'Who owns%'`).Scan(&someone)
	if someone != "Someone" {
		t.Fatalf("Jo's note is by %q", someone)
	}
}

func TestNoKeyMeansNoV1Sessions(t *testing.T) {
	s, err := LoadSessions(filepath.Join(t.TempDir(), "session.key"))
	if err != nil || s != nil {
		t.Fatalf("%v, %v", s, err)
	}
	if _, ok := s.UserID("anything"); ok {
		t.Fatal("nil sessions accepted a cookie")
	}
}
