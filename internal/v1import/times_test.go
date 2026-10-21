package v1import

import (
	"testing"
	"time"
)

func TestParseTime(t *testing.T) {
	// Each of these is a value found in a real v1 database.
	tests := []struct {
		in   string
		want time.Time
	}{
		{"2026-10-21 11:50:57.233391 +0100 BST m=+0.340860542", time.Date(2026, 10, 21, 10, 50, 57, 233391000, time.UTC)},
		{"2025-01-31 16:20:35.220574 +0000 GMT m=+384.711520126", time.Date(2025, 1, 31, 16, 20, 35, 220574000, time.UTC)},
		{"2026-03-01 09:00:00 +0000 UTC", time.Date(2026, 3, 1, 9, 0, 0, 0, time.UTC)},
		{"2024-12-19T00:00:00.000Z", time.Date(2024, 12, 19, 0, 0, 0, 0, time.UTC)},
		{"2026-10-31T00:00:00Z", time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)},
		{"2024-11-05 16:20:35", time.Date(2024, 11, 5, 16, 20, 35, 0, time.UTC)},
	}
	for _, tt := range tests {
		got, err := parseTime(tt.in)
		if err != nil || !got.Equal(tt.want) {
			t.Errorf("parseTime(%q) = %v, %v; want %v", tt.in, got, err, tt.want)
		}
	}
	if _, err := parseTime("last Tuesday"); err == nil {
		t.Error("nonsense parsed")
	}
}
