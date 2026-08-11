import { createSocketEvent } from "@/events";
import { useColumnActions } from "@/hooks/use-columns";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { DragEndEvent } from "@dnd-kit/core";
import { AnimatePresence } from "motion/react";
import { EmptyColumn, NoteSkeletons } from "./column-states";
import { Columns, DroppableColumn } from "./columns";
import { DraggableNote } from "./note";
import NoteDndContext from "./note-dnd";
import { DroppableNoteGroup } from "./note-group";

export default function Group() {
  const {
    retro: { columns },
  } = useRetro();
  const { notes, groupedNotes, loaded, dispatch } = useNotes();
  const columnActions = useColumnActions(notes);

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id as string | undefined;
    const note = notes.find((n) => n.id === event.active?.id);

    if (!note || !overId) return;

    let columnId = overId;
    let groupId = "";

    if (overId.includes(".")) {
      [columnId, groupId] = overId.split(".");
    }

    if (note.group_id === groupId) return;

    dispatch(
      createSocketEvent("note_update", {
        id: note.id,
        column_id: columnId,
        group_id: groupId,
      }),
    );
  }

  function handleUngroup(noteId: string) {
    dispatch(createSocketEvent("note_update", { id: noteId, group_id: "" }));
  }

  return (
    <NoteDndContext notes={notes} showAuthor onDragEnd={handleDragEnd}>
      <Columns
        onAddColumn={columnActions.create}
        canAddColumn={columnActions.canCreate}
      >
        {columns.map((column, index) => {
          const groups = Object.entries(groupedNotes[column.id] ?? {});

          return (
            <DroppableColumn
              column={column}
              index={index}
              key={column.id}
              {...columnActions.forColumn(column)}
            >
              {!loaded && <NoteSkeletons />}

              {loaded && groups.length === 0 && (
                <EmptyColumn>No thoughts in this column.</EmptyColumn>
              )}

              <AnimatePresence initial={false}>
                {groups.map(([groupId, groupNotes]) => (
                  <DroppableNoteGroup
                    columnId={column.id}
                    id={groupId}
                    key={groupId}
                  >
                    {groupNotes.map((note) => (
                      <DraggableNote
                        key={note.id}
                        note={note}
                        showAuthor
                        onUngroup={
                          groupNotes.length > 1
                            ? () => handleUngroup(note.id)
                            : undefined
                        }
                      />
                    ))}
                  </DroppableNoteGroup>
                ))}
              </AnimatePresence>
            </DroppableColumn>
          );
        })}
      </Columns>
    </NoteDndContext>
  );
}
