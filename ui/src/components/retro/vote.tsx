import { useColumnActions } from "@/hooks/use-columns";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { useVotes } from "@/hooks/use-votes";
import { AnimatePresence } from "motion/react";
import { useEffect } from "react";
import { EmptyColumn, NoteSkeletons } from "./column-states";
import { Column, Columns } from "./columns";
import { Note } from "./note";
import { VotableNoteGroup } from "./note-group";

export default function Vote({
  setVotesRemaining,
}: {
  setVotesRemaining: (votesRemaining: number) => void;
}) {
  const { retro } = useRetro();
  const { notes, groupedNotes, loaded } = useNotes();
  const columnActions = useColumnActions(notes);

  const { voted, count, toggle } = useVotes(retro.id);
  const canVote = retro.max_votes > count;

  useEffect(() => {
    setVotesRemaining(retro.max_votes - count);
  }, [retro.max_votes, count, setVotesRemaining]);

  return (
    <Columns
      onAddColumn={columnActions.create}
      canAddColumn={columnActions.canCreate}
    >
      {retro.columns.map((column, index) => {
        const groups = Object.entries(groupedNotes[column.id] ?? {});

        return (
          <Column
            key={column.id}
            column={column}
            index={index}
            {...columnActions.forColumn(column)}
          >
            {!loaded && <NoteSkeletons />}

            {loaded && groups.length === 0 && (
              <EmptyColumn>Nothing to vote on here.</EmptyColumn>
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              {groups.map(([groupId, groupNotes]) => (
                <VotableNoteGroup
                  onVote={(value) => toggle(groupId, value)}
                  voted={voted.has(groupId)}
                  canVote={canVote}
                  key={groupId}
                >
                  {groupNotes.map((note) => (
                    <Note key={note.id} note={note} showAuthor />
                  ))}
                </VotableNoteGroup>
              ))}
            </AnimatePresence>
          </Column>
        );
      })}
    </Columns>
  );
}
