import {
  PayloadError,
  PayloadNoteCreate,
  PayloadNoteUpdate,
  Ref,
  SocketEvent,
} from "@/events";
import { api } from "@/lib/api";
import { Note } from "@/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { ReadyState } from "react-use-websocket";
import { useAuth } from "./use-auth";
import useRetro from "./use-retro";
import {
  useReadyState,
  useRetroSocket,
  useSocketEvent,
} from "./use-retro-socket";

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
            created_by_name: payload.created_by_name,
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

function notesByColumn(notes: Note[]) {
  const columns: Record<string, Note[]> = {};

  notes.forEach((note) => {
    (columns[note.column_id] ??= []).push(note);
  });

  return columns;
}

export { groupNotes, notesByColumn, notesReducer, initialState };
export type { NotesState };

export type NotesValue = {
  notes: Note[];
  groupedNotes: GroupedNotes;
  notesByColumn: Record<string, Note[]>;
  loaded: boolean;
  dispatch: (event: SocketEvent) => void;
};

export const NotesContext = createContext<NotesValue | null>(null);

export function useNotes() {
  const ctx = useContext(NotesContext);

  if (!ctx) throw new Error("useNotes must be used within a NotesProvider");

  return ctx;
}

export function useNotesState(loaded: Note[]): NotesValue {
  const { retro } = useRetro();
  const { user } = useAuth();
  const { send } = useRetroSocket();
  const readyState = useReadyState();

  // Seeded through the reducer rather than by hand, so loaded and rollbacks
  // cannot drift from what note_index already does.
  const [state, dispatch] = useReducer(notesReducer, loaded, (notes) =>
    notesReducer(initialState, { name: "note_index", payload: notes }),
  );

  const groupedNotes = useMemo(() => groupNotes(state.notes), [state.notes]);
  const byColumn = useMemo(() => notesByColumn(state.notes), [state.notes]);

  const dispatchAndSend = useCallback(
    (event: SocketEvent) => {
      const tracked: SocketEvent = optimisticEvents.has(event.name)
        ? {
            ...event,
            payload: { ...event.payload, ref: crypto.randomUUID() },
          }
        : event;

      send(tracked);

      dispatch(
        tracked.name === "note_create"
          ? {
              ...tracked,
              payload: { ...tracked.payload, created_by_name: user?.name },
            }
          : tracked,
      );
    },
    [send, user?.name],
  );

  useSocketEvent(dispatch);

  const load = useCallback(() => {
    api.get<Note[]>(`/api/retros/${retro.id}/notes`).then((res) => {
      dispatch({ name: "note_index", payload: res.data });
    });
  }, [retro.id]);

  // Nothing replays what the socket missed while it was down, and this hook no
  // longer remounts per stage to refetch by accident, so a reconnect has to ask
  // the server for the list again. The route loader covers the first connection.
  const dropped = useRef(false);

  useEffect(() => {
    if (readyState === ReadyState.CLOSED) {
      dropped.current = true;
      return;
    }

    if (readyState === ReadyState.OPEN && dropped.current) {
      dropped.current = false;
      load();
    }
  }, [readyState, load]);

  return useMemo(
    () => ({
      notes: state.notes,
      groupedNotes,
      notesByColumn: byColumn,
      loaded: state.loaded,
      dispatch: dispatchAndSend,
    }),
    [state.notes, state.loaded, groupedNotes, byColumn, dispatchAndSend],
  );
}
