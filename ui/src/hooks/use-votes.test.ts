import { describe, expect, it } from "vitest";
import {
  initialVotesState,
  votesReducer,
  VotesEvent,
  VotesState,
} from "./use-votes";

function replay(...events: VotesEvent[]): VotesState {
  return events.reduce(votesReducer, initialVotesState);
}

describe("votesReducer", () => {
  it("shows a vote before the server has seen it", () => {
    const state = replay({
      name: "vote",
      payload: { group_id: "group-1", value: true },
    });

    expect(state.votes).toEqual([{ group_id: "group-1" }]);
  });

  it("removes a vote before the server has seen it", () => {
    const state = replay(
      { name: "vote_index", payload: [{ group_id: "group-1" }] },
      { name: "vote", payload: { group_id: "group-1", value: false } },
    );

    expect(state.votes).toEqual([]);
  });

  it("takes the server's list as the truth", () => {
    const state = replay(
      { name: "vote", payload: { group_id: "group-1", value: true } },
      {
        name: "voted",
        payload: {
          group_id: "group-1",
          votes: [{ group_id: "group-1" }, { group_id: "group-2" }],
        },
      },
    );

    expect(state.votes.map((v) => v.group_id)).toEqual(["group-1", "group-2"]);
    expect(state.rollbacks).toEqual({});
  });

  it("puts the vote back when the request fails", () => {
    const state = replay(
      { name: "vote_index", payload: [{ group_id: "group-1" }] },
      { name: "vote", payload: { group_id: "group-1", value: false } },
      { name: "vote_failed", payload: { group_id: "group-1" } },
    );

    expect(state.votes).toEqual([{ group_id: "group-1" }]);
    expect(state.rollbacks).toEqual({});
  });

  it("rolls back only the group that failed", () => {
    const state = replay(
      { name: "vote", payload: { group_id: "group-1", value: true } },
      { name: "vote", payload: { group_id: "group-2", value: true } },
      { name: "vote_failed", payload: { group_id: "group-2" } },
    );

    expect(state.votes.map((v) => v.group_id)).toEqual(["group-1"]);
    expect(state.rollbacks).toEqual({ "group-1": [] });
  });

  it("rolls back to the last confirmed state, not to a pending click", () => {
    const state = replay(
      { name: "vote_index", payload: [] },
      { name: "vote", payload: { group_id: "group-1", value: true } },
      { name: "vote", payload: { group_id: "group-1", value: false } },
      { name: "vote_failed", payload: { group_id: "group-1" } },
    );

    expect(state.votes).toEqual([]);
  });

  it("ignores a failure it has no rollback for", () => {
    const state = replay(
      { name: "vote_index", payload: [{ group_id: "group-1" }] },
      { name: "vote_failed", payload: { group_id: "group-9" } },
    );

    expect(state.votes).toEqual([{ group_id: "group-1" }]);
  });
});
