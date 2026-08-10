import { createSocketEvent } from "@/events";
import { useColumnActions } from "@/hooks/use-columns";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { AnimatePresence } from "motion/react";
import { EmptyColumn, NoteSkeletons } from "./column-states";
import { Columns, DroppableColumn } from "./columns";
import { DraggableNote } from "./note";
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
      // Dragged onto an existing group rather than empty column space.
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

  return (
    <DndContext onDragEnd={handleDragEnd}>
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

              <AnimatePresence mode="popLayout" initial={false}>
                {groups.map(([groupId, groupNotes]) => (
                  <DroppableNoteGroup
                    columnId={column.id}
                    id={groupId}
                    key={groupId}
                  >
                    {groupNotes.map((note) => (
                      <DraggableNote key={note.id} note={note} showAuthor />
                    ))}
                  </DroppableNoteGroup>
                ))}
              </AnimatePresence>
            </DroppableColumn>
          );
        })}
      </Columns>
    </DndContext>
  );
}
