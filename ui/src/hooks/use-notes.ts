import {
  PayloadError,
  PayloadNoteCreate,
  PayloadNoteUpdate,
  Ref,
  SocketEvent,
} from "@/events";
import { api } from "@/lib/api";
import { Note } from "@/types";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import useRetro from "./use-retro";
import { useRetroSocket, useSocketEvent } from "./use-retro-socket";

const optimisticEvents = new Set(["note_create", "note_update", "note_delete"]);

interface NotesState {
  notes: Note[];
  loaded: boolean;
  rollbacks: Record<string, Note | null>;
}

const initialState: NotesState = { notes: [], loaded: false, rollbacks: {} };

function upsert(notes: Note[], note: Note): Note[] {
  return notes.some((n) => n.id === note.id)
    ? notes.map((n) => (n.id === note.id ? note : n))
    : [...notes, note];
}

function forget(
  rollbacks: NotesState["rollbacks"],
  ref?: string,
): NotesState["rollbacks"] {
  if (!ref || !(ref in rollbacks)) return rollbacks;

  const next = { ...rollbacks };
  delete next[ref];

  return next;
}

function toNote(payload: Note & Partial<Ref>): Note {
  const note = { ...payload };
  delete note.ref;

  return note;
}

function notesReducer(state: NotesState, event: SocketEvent): NotesState {
  switch (event.name) {
    case "note_index": {
      return { notes: event.payload as Note[], loaded: true, rollbacks: {} };
    }

    case "note_create": {
      const payload = event.payload as PayloadNoteCreate & Ref;

      return {
        ...state,
        notes: [
          ...state.notes,
          {
            id: payload.ref,
            created_by_me: true,
            content: payload.content,
            column_id: payload.column_id,
            group_id: payload.ref,
            img_url: "",
          },
        ],
        rollbacks: { ...state.rollbacks, [payload.ref]: null },
      };
    }

    case "note_update": {
      const payload = event.payload as PayloadNoteUpdate & Ref;
      const before = state.notes.find((note) => note.id === payload.id);
      if (!before) return state;

      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === payload.id
            ? {
                ...note,
                content: payload.content ?? note.content,
                column_id: payload.column_id ?? note.column_id,
                group_id: payload.group_id ?? `ungrouped-${note.id}`,
                img_url: payload.remove_img_url
                  ? ""
                  : (payload.img_url ?? note.img_url),
              }
            : note,
        ),
        rollbacks: { ...state.rollbacks, [payload.ref]: before },
      };
    }

    case "note_delete": {
      const payload = event.payload as { id: string } & Ref;
      const before = state.notes.find((note) => note.id === payload.id);
      if (!before) return state;

      return {
        ...state,
        notes: state.notes.filter((note) => note.id !== payload.id),
        rollbacks: { ...state.rollbacks, [payload.ref]: before },
      };
    }

    case "note_created": {
      const payload = event.payload as Note & Partial<Ref>;

      const notes = payload.ref
        ? state.notes.filter((note) => note.id !== payload.ref)
        : state.notes;

      return {
        ...state,
        notes: upsert(notes, toNote(payload)),
        rollbacks: forget(state.rollbacks, payload.ref),
      };
    }

    case "note_updated": {
      const payload = event.payload as Note & Partial<Ref>;

      return {
        ...state,
        notes: upsert(state.notes, toNote(payload)),
        rollbacks: forget(state.rollbacks, payload.ref),
      };
    }

    case "note_deleted": {
      const payload = event.payload as { id: string } & Partial<Ref>;

      return {
        ...state,
        notes: state.notes.filter((note) => note.id !== payload.id),
        rollbacks: forget(state.rollbacks, payload.ref),
      };
    }

    case "error": {
      const { ref } = event.payload as PayloadError;
      if (!ref || !(ref in state.rollbacks)) return state;

      const before = state.rollbacks[ref];

      return {
        ...state,
        notes:
          before === null
            ? state.notes.filter((note) => note.id !== ref)
            : upsert(state.notes, before),
        rollbacks: forget(state.rollbacks, ref),
      };
    }

    default:
      return state;
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

export { groupNotes, notesReducer, initialState };
export type { NotesState };

export function useNotes() {
  const { retro } = useRetro();
  const { send } = useRetroSocket();
  const [state, dispatch] = useReducer(notesReducer, initialState);

  const groupedNotes = useMemo(() => groupNotes(state.notes), [state.notes]);

  const dispatchAndSend = useCallback(
    (event: SocketEvent) => {
      const tracked: SocketEvent = optimisticEvents.has(event.name)
        ? {
            ...event,
            payload: { ...event.payload, ref: crypto.randomUUID() },
          }
        : event;

      dispatch(tracked);
      send(tracked);
    },
    [send],
  );

  useSocketEvent(dispatch);

  useEffect(() => {
    api.get<Note[]>(`/api/retros/${retro.id}/notes`).then((res) => {
      dispatch({ name: "note_index", payload: res.data });
    });
  }, [retro.id]);

  return {
    notes: state.notes,
    groupedNotes,
    loaded: state.loaded,
    dispatch: dispatchAndSend,
  };
}
