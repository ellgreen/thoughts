package resources

import (
	"slices"
	"strings"

	"github.com/ellgreen/thoughts/cmd/thoughts/model"
	"github.com/google/uuid"
	"github.com/samber/lo"
)

type Vote struct {
	GroupID uuid.UUID `json:"group_id"`
}

type VoteWithCount struct {
	GroupID uuid.UUID `json:"group_id"`
	Count   int       `json:"count"`
}

func VotesFromModel(votes []*model.Vote) []*Vote {
	return lo.Map(votes, func(vote *model.Vote, _ int) *Vote {
		return &Vote{
			GroupID: vote.GroupID,
		}
	})
}

func VotesWithCountFromModel(votes []*model.Vote) []*VoteWithCount {
	groupVoteCounts := map[uuid.UUID]int{}

	for _, vote := range votes {
		groupVoteCounts[vote.GroupID]++
	}

	votesWithCount := make([]*VoteWithCount, 0, len(groupVoteCounts))

	for groupID, count := range groupVoteCounts {
		votesWithCount = append(votesWithCount, &VoteWithCount{
			GroupID: groupID,
			Count:   count,
		})
	}

	// Map iteration order is randomised per run; sort so the response is
	// stable instead of shuffling the group order on every request.
	slices.SortFunc(votesWithCount, func(a, b *VoteWithCount) int {
		return strings.Compare(a.GroupID.String(), b.GroupID.String())
	})

	return votesWithCount
}
