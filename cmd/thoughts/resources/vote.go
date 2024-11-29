package resources

import (
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

	votesWithCount := make([]*VoteWithCount, 0)

	for groupID, count := range groupVoteCounts {
		votesWithCount = append(votesWithCount, &VoteWithCount{
			GroupID: groupID,
			Count:   count,
		})
	}

	return votesWithCount
}
