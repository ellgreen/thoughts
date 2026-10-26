package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db  *sql.DB
	now func() time.Time
}

func New(d *sql.DB) *Store {
	return &Store{db: d, now: time.Now}
}

func (s *Store) inTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

var ids struct {
	sync.Mutex
	ms  uint64
	seq uint16
}

// newID is a UUIDv7, so v2 ids look like the v4 ones v1 made and sort by
// creation time. Within one millisecond a counter in the 12 bits after the
// version keeps them increasing (RFC 9562 section 6.2, method 1), which
// "which retro came first" relies on.
func newID(now time.Time) string {
	ids.Lock()
	ms := uint64(now.UnixMilli())
	if ms <= ids.ms {
		ms = ids.ms
		if ids.seq++; ids.seq > 0xfff {
			ms++
			ids.seq = 0
		}
	} else {
		ids.seq = 0
	}
	ids.ms = ms
	seq := ids.seq
	ids.Unlock()

	var b [16]byte
	_, _ = rand.Read(b[8:])
	for i := range 6 {
		b[i] = byte(ms >> (40 - 8*i))
	}
	b[6] = 0x70 | byte(seq>>8)
	b[7] = byte(seq)
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func hash(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func stamp(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func parseStamp(s string) (time.Time, error) {
	return time.Parse(time.RFC3339, s)
}
