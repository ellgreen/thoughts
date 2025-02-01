import { PayloadNoteCreate, PayloadNoteUpdate, SocketEvent } from "@/events";
import { api } from "@/lib/api";
import { Note } from "@/types";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import useRetro from "./use-retro";

function notesReducer(notes: Note[], event: SocketEvent): Note[] {
  switch (event.name) {
    case "error": {
      return notes.filter((note) => note.id !== "placeholder");
    }
    case "note_index": {
      return event.payload as Note[];
    }
    case "note_create": {
      const payload = event.payload as PayloadNoteCreate;
      return [
        ...notes,
        {
          id: "placeholder",
          created_by_me: true,
          content: payload.content,
          column_id: payload.column_id,
          group_id: "placeholder",
          img_url: "",
        },
      ];
    }
    case "note_created": {
      const payload = event.payload as Note;
      return [
        ...notes.filter(
          (note) => note.id !== "placeholder" && note.id !== payload.id,
        ),
        payload,
      ];
    }
    case "note_update": {
      const payload = event.payload as PayloadNoteUpdate;
      return notes.map((note) =>
        note.id === payload.id
          ? {
              ...note,
              content: payload.content ?? note.content,
              column_id: payload.column_id ?? note.column_id,
              group_id: payload.group_id ?? `placeholder-${note.id}`,
            }
          : note,
      );
    }
    case "note_updated": {
      const payload = event.payload as Note;
      return notes.map((note) => (note.id === payload.id ? payload : note));
    }
    case "note_delete": {
      const payload = event.payload as { id: string };
      return notes.filter((note) => note.id !== payload.id);
    }
    case "note_deleted": {
      const payload = event.payload as { id: string };
      return notes.filter((note) => note.id !== payload.id);
    }
    default:
      return notes;
  }
}

interface GroupedNotes {
  [columnId: string]: {
    [groupId: string]: Note[];
  };
}

function groupNotes(notes: Note[]) {
  const groups: GroupedNotes = {};

  notes.forEach((note) => {
    if (!groups[note.column_id]) {
      groups[note.column_id] = {};
    }

    if (!groups[note.column_id][note.group_id]) {
      groups[note.column_id][note.group_id] = [];
    }

    groups[note.column_id][note.group_id].push(note);
  });

  return groups;
}

export function useNotes() {
  const {
    retro,
    socket: { lastJsonMessage, sendJsonMessage },
  } = useRetro();
  const [notes, dispatch] = useReducer(notesReducer, []);

  const groupedNotes = useMemo(() => groupNotes(notes), [notes]);

  const dispatchAndSend = useCallback((event: SocketEvent) => {
    dispatch(event);
    sendJsonMessage(event);
  }, []);

  useEffect(() => {
    if (!lastJsonMessage) return;

    dispatch(lastJsonMessage as SocketEvent);
  }, [lastJsonMessage]);

  useEffect(() => {
    api.get<Note[]>(`/api/retros/${retro.id}/notes`).then((res) => {
      dispatch({ name: "note_index", payload: res.data });
    });
  }, [retro.id]);

  return { notes, groupedNotes, dispatch: dispatchAndSend };
}
