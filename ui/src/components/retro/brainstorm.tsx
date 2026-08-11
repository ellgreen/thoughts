import { createSocketEvent } from "@/events";
import { useColumnActions } from "@/hooks/use-columns";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Button } from "../ui/button";
import { EmptyColumn, NoteSkeletons } from "./column-states";
import { Columns, DroppableColumn } from "./columns";
import { DraggableNote, Note } from "./note";
import NoteDialog from "./note-dialog";
import NoteDndContext from "./note-dnd";

export default function Brainstorm() {
  const {
    retro: { columns },
  } = useRetro();
  const { notes, loaded, dispatch } = useNotes();
  const columnActions = useColumnActions(notes);

  function handleNewNote(columnId: string, content: string) {
    dispatch(
      createSocketEvent("note_create", {
        column_id: columnId,
        content,
      }),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const overColumnId = event.over?.id;
    const note = notes.find((n) => n.id === event.active?.id);

    // Dropped outside any column, or the column vanished mid-drag.
    if (!note || !overColumnId) return;

    if (note.column_id === overColumnId) return;

    dispatch(
      createSocketEvent("note_update", {
        id: note.id,
        column_id: overColumnId,
      }),
    );
  }

  function handleNoteEdit(noteId: string, content: string) {
    dispatch(createSocketEvent("note_update", { id: noteId, content }));
  }

  function handleNoteDelete(noteId: string) {
    dispatch(createSocketEvent("note_delete", { id: noteId }));
  }

  function handleNoteGifSelected(noteId: string, url: string) {
    dispatch(createSocketEvent("note_update", { id: noteId, img_url: url }));
  }

  function handleNoteGifRemoved(noteId: string) {
    dispatch(
      createSocketEvent("note_update", { id: noteId, remove_img_url: true }),
    );
  }

  return (
    <NoteDndContext notes={notes} onDragEnd={handleDragEnd}>
      <Columns
        onAddColumn={columnActions.create}
        canAddColumn={columnActions.canCreate}
      >
        {columns.map((column, index) => {
          const columnNotes = notes.filter((n) => n.column_id === column.id);

          return (
            <DroppableColumn
              column={column}
              index={index}
              key={column.id}
              {...columnActions.forColumn(column)}
            >
              <NoteDialog
                title="New note"
                description="Only you can read this until everyone moves on to grouping."
                onContentSave={(content) => handleNewNote(column.id, content)}
              >
                <Button variant="secondary" className="w-full">
                  <Plus />
                  Add a thought
                </Button>
              </NoteDialog>

              {!loaded && <NoteSkeletons />}

              {loaded && columnNotes.length === 0 && (
                <EmptyColumn>Nothing here yet.</EmptyColumn>
              )}

              {/* Not popLayout: a note moving column is one card changing
                  place, and popLayout tears it out of the flow to animate it
                  away while its layoutId is gliding it to the new column. */}
              <AnimatePresence initial={false}>
                {columnNotes.map((note) =>
                  note.created_by_me ? (
                    <DraggableNote
                      key={note.id}
                      note={note}
                      onEdit={(content) => handleNoteEdit(note.id, content)}
                      onDelete={() => handleNoteDelete(note.id)}
                      onGifSelected={(url) =>
                        handleNoteGifSelected(note.id, url)
                      }
                      onGifRemoved={() => handleNoteGifRemoved(note.id)}
                    />
                  ) : (
                    <Note key={note.id} note={note} blur />
                  ),
                )}
              </AnimatePresence>
            </DroppableColumn>
          );
        })}
      </Columns>
    </NoteDndContext>
  );
}
