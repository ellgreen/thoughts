import { createSocketEvent } from "@/events";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Columns, DroppableColumn } from "./columns";
import { DraggableNote, Note } from "./note";
import NoteDialog from "./note-dialog";

export default function Brainstorm() {
  const {
    retro: { columns, gifs_enabled },
  } = useRetro();
  const { notes, dispatch } = useNotes();

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

    if (note?.column_id === overColumnId) return;

    dispatch(
      createSocketEvent("note_update", {
        id: note?.id,
        column_id: overColumnId,
      }),
    );
  }

  function handleNoteEdit(noteId: string, content: string) {
    dispatch(
      createSocketEvent("note_update", {
        id: noteId,
        content,
      }),
    );
  }

  function handleNoteGifSelected(noteId: string, url: string) {
    dispatch(
      createSocketEvent("note_update", {
        id: noteId,
        img_url: url,
      }),
    );
  }

  function handleNoteGifRemoved(noteId: string) {
    dispatch(
      createSocketEvent("note_update", {
        id: noteId,
        remove_img_url: true,
      }),
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Columns>
        {columns.map((column) => (
          <DroppableColumn column={column} key={column.id}>
            <NoteDialog
              title="New Note"
              description="Create a new note."
              onContentSave={(content) => handleNewNote(column.id, content)}
            >
              <Button variant="secondary" className="w-full">
                <Plus />
              </Button>
            </NoteDialog>

            {notes
              .filter((n) => n.column_id == column.id)
              .map((note) => (
                <div key={note.id} className="animate-in fade-in zoom-in-110">
                  {note.created_by_me ? (
                    <DraggableNote
                      note={note}
                      onEdit={(content) => handleNoteEdit(note.id, content)}
                      onGifSelected={
                        gifs_enabled
                          ? (url) => handleNoteGifSelected(note.id, url)
                          : undefined
                      }
                      onGifRemoved={
                        gifs_enabled
                          ? () => handleNoteGifRemoved(note.id)
                          : undefined
                      }
                    />
                  ) : (
                    <Note note={note} blur />
                  )}
                </div>
              ))}
          </DroppableColumn>
        ))}
      </Columns>
    </DndContext>
  );
}
