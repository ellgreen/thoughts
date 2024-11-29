import { createSocketEvent } from "@/events";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Columns, DroppableColumn } from "./columns";
import { DraggableNote } from "./note";
import { DroppableNoteGroup } from "./note-group";

export default function Group() {
  const {
    retro: { columns },
  } = useRetro();
  const { notes, groupedNotes, dispatch } = useNotes();

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id as string | undefined;
    const note = notes.find((n) => n.id === event.active?.id);

    if (!note || !overId) return;

    let columnId = overId;
    let groupId = "";

    if (overId.includes(".")) {
      // Dragged to a group
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
      <Columns>
        {columns.map((column) => (
          <DroppableColumn column={column} key={column.id}>
            {Object.entries(groupedNotes[column.id] ?? []).map(
              ([groupId, groupNotes]) => (
                <DroppableNoteGroup
                  columnId={column.id}
                  id={groupId}
                  key={groupId}
                >
                  {groupNotes.map((note) => (
                    <DraggableNote key={note.id} note={note} />
                  ))}
                </DroppableNoteGroup>
              ),
            )}
          </DroppableColumn>
        ))}
      </Columns>
    </DndContext>
  );
}
