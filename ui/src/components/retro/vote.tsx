import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { Column, Columns } from "./columns";
import { Note } from "./note";
import { VotableNoteGroup } from "./note-group";

interface Vote {
  group_id: string;
}

export default function Vote() {
  const { retro } = useRetro();
  const { groupedNotes } = useNotes();

  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    api.get(`/api/retros/${retro.id}/votes`).then((res) => {
      setVotes(res.data);
    });
  }, [retro.id]);

  function handleVote(groupId: string, value: boolean) {
    api
      .post(`/api/retros/${retro.id}/votes`, { group_id: groupId, value })
      .then((res) => {
        if (res.status === 200) {
          setVotes(res.data);
        }
      });
  }

  return (
    <Columns>
      {retro.columns.map((column) => (
        <Column key={column.id} column={column}>
          {Object.entries(groupedNotes[column.id] ?? []).map(
            ([groupId, groupNotes]) => (
              <VotableNoteGroup
                onVote={(value) => handleVote(groupId, value)}
                voted={!!votes.find((vote) => vote.group_id === groupId)}
                key={groupId}
              >
                {groupNotes.map((note) => (
                  <Note key={note.id} note={note} />
                ))}
              </VotableNoteGroup>
            ),
          )}
        </Column>
      ))}
    </Columns>
  );
}