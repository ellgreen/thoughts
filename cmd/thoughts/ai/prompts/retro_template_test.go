package prompts

import (
	"strings"
	"testing"
)

func column(title, description string) struct {
	Title       string `json:"title"`
	Description string `json:"description"`
} {
	return struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}{Title: title, Description: description}
}

func TestClampTrimsExtraColumns(t *testing.T) {
	resp := RetroTemplateResponse{Theme: "Star Wars"}

	for range 8 {
		resp.Columns = append(resp.Columns, column("A column ✨", "Something"))
	}

	got := clamp(resp)

	// The create endpoint accepts at most five, and the person never chose
	// these columns, so a validation error would be baffling.
	if len(got.Columns) != maxColumns {
		t.Errorf("got %d columns, want %d", len(got.Columns), maxColumns)
	}
}

func TestClampLeavesAGoodResponseAlone(t *testing.T) {
	resp := RetroTemplateResponse{
		Theme: "Star Wars",
		Columns: []struct {
			Title       string `json:"title"`
			Description string `json:"description"`
		}{
			column("Light Side Wins ✨", "What went well this sprint?"),
			column("Dark Side Risks 🌑", "What is threatening us?"),
		},
	}

	got := clamp(resp)

	if len(got.Columns) != 2 || got.Columns[0].Title != "Light Side Wins ✨" {
		t.Errorf("a valid response was altered: %+v", got)
	}

	if got.Theme != "Star Wars" {
		t.Errorf("theme changed to %q", got.Theme)
	}
}

func TestClampTruncatesOverlongFields(t *testing.T) {
	long := strings.Repeat("a", 400)

	got := clamp(RetroTemplateResponse{
		Theme: long,
		Columns: []struct {
			Title       string `json:"title"`
			Description string `json:"description"`
		}{column(long, long)},
	})

	if len([]rune(got.Theme)) != maxFieldLength {
		t.Errorf("theme is %d runes, want %d", len([]rune(got.Theme)), maxFieldLength)
	}

	if len([]rune(got.Columns[0].Title)) != maxFieldLength {
		t.Errorf("title is %d runes, want %d", len([]rune(got.Columns[0].Title)), maxFieldLength)
	}

	if len([]rune(got.Columns[0].Description)) != maxFieldLength {
		t.Errorf("description is %d runes, want %d", len([]rune(got.Columns[0].Description)), maxFieldLength)
	}
}

func TestTruncateCountsRunesNotBytes(t *testing.T) {
	// Titles end in an emoji by design, so cutting on bytes would leave a
	// mangled rune at the end.
	got := truncate(strings.Repeat("🚀", 10), 4)

	if len([]rune(got)) != 4 {
		t.Errorf("got %d runes, want 4", len([]rune(got)))
	}

	if !strings.HasSuffix(got, "🚀") {
		t.Errorf("truncation split a rune: %q", got)
	}
}
