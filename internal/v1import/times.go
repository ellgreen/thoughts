package v1import

import (
	"fmt"
	"strings"
	"time"
)

// v1 handed time.Time straight to the SQLite driver, which stored Go's
// String() form: "2026-09-12 17:08:21.819436 +0100 BST m=+114.64". The
// m=+ part is the monotonic clock reading and means nothing once stored.
// Rows written by SQLite's own default use "2006-01-02 15:04:05" in UTC.
var layouts = []string{
	"2006-01-02 15:04:05.999999999 -0700 MST",
	"2006-01-02 15:04:05.999999999 -0700",
	time.RFC3339Nano,
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04:05.999999999",
	time.DateOnly,
}

func parseTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, " m="); i >= 0 {
		s = s[:i]
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognised v1 time %q", s)
}
