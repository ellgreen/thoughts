import { api } from "@/lib/api";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { toast } from "sonner";

// Only the vote stage. In discuss the same endpoint returns votes with counts
// for everyone, not this user's own list.
export interface Vote {
  group_id: string;
}

export interface VotesState {
  votes: Vote[];
  rollbacks: Record<string, Vote[]>;
}

export const initialVotesState: VotesState = { votes: [], rollbacks: {} };

export type VotesEvent =
  | { name: "vote_index"; payload: Vote[] }
  | { name: "vote"; payload: { group_id: string; value: boolean } }
  | { name: "voted"; payload: { group_id: string; votes: Vote[] } }
  | { name: "vote_failed"; payload: { group_id: string } };

function forget(rollbacks: VotesState["rollbacks"], groupId: string) {
  if (!(groupId in rollbacks)) return rollbacks;

  const next = { ...rollbacks };
  delete next[groupId];

  return next;
}

export function votesReducer(state: VotesState, event: VotesEvent): VotesState {
  switch (event.name) {
    case "vote_index":
      return { votes: event.payload, rollbacks: {} };

    case "vote": {
      const { group_id, value } = event.payload;

      return {
        votes: value
          ? [...state.votes, { group_id }]
          : state.votes.filter((vote) => vote.group_id !== group_id),
        // Only the first stash: clicking twice before either lands should roll
        // back to what the server last confirmed, not to the other click.
        rollbacks:
          group_id in state.rollbacks
            ? state.rollbacks
            : { ...state.rollbacks, [group_id]: state.votes },
      };
    }

    case "voted":
      return {
        votes: event.payload.votes,
        rollbacks: forget(state.rollbacks, event.payload.group_id),
      };

    case "vote_failed": {
      const { group_id } = event.payload;
      const before = state.rollbacks[group_id];

      if (!before) return state;

      return { votes: before, rollbacks: forget(state.rollbacks, group_id) };
    }

    default:
      return state;
  }
}

export function useVotes(retroId: string) {
  const [state, dispatch] = useReducer(votesReducer, initialVotesState);
  const inFlight = useRef<Record<string, number>>({});

  useEffect(() => {
    api.get<Vote[]>(`/api/retros/${retroId}/votes`).then((res) => {
      dispatch({ name: "vote_index", payload: res.data });
    });
  }, [retroId]);

  const toggle = useCallback(
    (groupId: string, value: boolean) => {
      dispatch({ name: "vote", payload: { group_id: groupId, value } });

      const ticket = (inFlight.current[groupId] =
        (inFlight.current[groupId] ?? 0) + 1);

      api
        .post<Vote[]>(`/api/retros/${retroId}/votes`, {
          group_id: groupId,
          value,
        })
        .then((res) => {
          // A slow response to an older click would otherwise undo a newer one.
          if (inFlight.current[groupId] !== ticket) return;

          dispatch({
            name: "voted",
            payload: { group_id: groupId, votes: res.data },
          });
        })
        .catch(() => {
          if (inFlight.current[groupId] !== ticket) return;

          dispatch({ name: "vote_failed", payload: { group_id: groupId } });

          toast("Your vote didn't stick", {
            description: "We couldn't reach the server, so it's been undone.",
          });
        });
    },
    [retroId],
  );

  const voted = useMemo(
    () => new Set(state.votes.map((vote) => vote.group_id)),
    [state.votes],
  );

  return { voted, count: state.votes.length, toggle };
}
