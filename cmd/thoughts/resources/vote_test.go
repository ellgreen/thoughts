package resources_test

import (
	"testing"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/ellgreen/thoughts/cmd/thoughts/resources"
	"github.com/google/uuid"
)

// Ranging over a map randomises Go's own iteration order, so this asserts
// the same input always produces the same output order - not just that the
// counts are right.
func TestVotesWithCountFromModelIsOrderedDeterministically(t *testing.T) {
	groupA := uuid.New()
	groupB := uuid.New()
	groupC := uuid.New()

	votes := []*model.Vote{
		{GroupID: groupA}, {GroupID: groupB}, {GroupID: groupA},
		{GroupID: groupC}, {GroupID: groupB}, {GroupID: groupB},
	}

	first := resources.VotesWithCountFromModel(votes)

	for i := 0; i < 50; i++ {
		got := resources.VotesWithCountFromModel(votes)

		if len(got) != len(first) {
			t.Fatalf("run %d: expected %d groups, got %d", i, len(first), len(got))
		}

		for j := range first {
			if got[j].GroupID != first[j].GroupID || got[j].Count != first[j].Count {
				t.Fatalf("run %d: order changed at position %d: expected %+v, got %+v",
					i, j, first[j], got[j])
			}
		}
	}

	counts := map[uuid.UUID]int{}
	for _, v := range first {
		counts[v.GroupID] = v.Count
	}

	if counts[groupA] != 2 || counts[groupB] != 3 || counts[groupC] != 1 {
		t.Errorf("unexpected counts: %+v", counts)
	}
}
