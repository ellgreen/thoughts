package requests

import (
	"testing"

	"github.com/google/uuid"
)

type target struct {
	Name     string    `json:"name" validate:"required,min=2"`
	Count    int       `json:"count"`
	ID       uuid.UUID `json:"id"`
	Tags     []string  `json:"tags"`
	Flag     bool      `json:"flag"`
	Untagged string
}

func TestFromMapBindsSupportedTypes(t *testing.T) {
	id := uuid.New()

	got, err := FromMap[target](map[string]any{
		"name":  "a name",
		"count": float64(7), // JSON numbers decode as float64
		"id":    id.String(),
		"tags":  []any{"one", "two"},
		"flag":  true,
	})

	if err != nil {
		t.Fatalf("expected the payload to bind, got %v", err)
	}

	if got.Name != "a name" {
		t.Errorf("Name = %q, want %q", got.Name, "a name")
	}

	if got.Count != 7 {
		t.Errorf("Count = %d, want 7", got.Count)
	}

	if got.ID != id {
		t.Errorf("ID = %s, want %s", got.ID, id)
	}

	if len(got.Tags) != 2 || got.Tags[0] != "one" || got.Tags[1] != "two" {
		t.Errorf("Tags = %v, want [one two]", got.Tags)
	}

	if !got.Flag {
		t.Error("Flag = false, want true")
	}
}

func TestFromMapAcceptsIntsAsStrings(t *testing.T) {
	got, err := FromMap[target](map[string]any{"name": "ok", "count": "42"})
	if err != nil {
		t.Fatalf("expected a numeric string to bind, got %v", err)
	}

	if got.Count != 42 {
		t.Errorf("Count = %d, want 42", got.Count)
	}
}

func TestFromMapLeavesAbsentKeysAtTheirZeroValue(t *testing.T) {
	got, err := FromMap[target](map[string]any{"name": "ok"})
	if err != nil {
		t.Fatalf("expected a partial payload to bind, got %v", err)
	}

	if got.Count != 0 || got.ID != uuid.Nil || got.Tags != nil || got.Flag {
		t.Errorf("absent keys were not left at their zero value: %+v", got)
	}
}

func TestFromMapIgnoresUnknownAndUntaggedFields(t *testing.T) {
	got, err := FromMap[target](map[string]any{
		"name":     "ok",
		"Untagged": "should be ignored",
		"nonsense": 1,
	})

	if err != nil {
		t.Fatalf("expected unknown keys to be ignored, got %v", err)
	}

	if got.Untagged != "" {
		t.Errorf("a field with no json tag was bound: %q", got.Untagged)
	}
}

func TestFromMapRejectsBadValues(t *testing.T) {
	cases := map[string]map[string]any{
		"unparseable int":     {"name": "ok", "count": "not a number"},
		"int from bool":       {"name": "ok", "count": true},
		"unparseable uuid":    {"name": "ok", "id": "tasks"},
		"uuid from number":    {"name": "ok", "id": float64(3)},
		"slice of non-string": {"name": "ok", "tags": []any{1, 2}},
		"slice from string":   {"name": "ok", "tags": "one"},
	}

	for name, payload := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := FromMap[target](payload); err == nil {
				t.Errorf("expected %v to be rejected", payload)
			}
		})
	}
}

func TestFromMapRunsValidation(t *testing.T) {
	if _, err := FromMap[target](map[string]any{}); err == nil {
		t.Error("expected a missing required field to be rejected")
	}

	_, err := FromMap[target](map[string]any{"name": "a"})
	if err == nil {
		t.Fatal("expected a too-short value to be rejected")
	}

	if err.Error() != "Name should contain more than 2 characters" {
		t.Errorf("unexpected validation message: %q", err.Error())
	}
}

func TestFromMapTreatsAnEmptyUUIDStringAsNil(t *testing.T) {
	got, err := FromMap[target](map[string]any{"name": "ok", "id": ""})
	if err != nil {
		t.Fatalf("expected an empty uuid to bind as nil, got %v", err)
	}

	if got.ID != uuid.Nil {
		t.Errorf("ID = %s, want the nil UUID", got.ID)
	}
}
