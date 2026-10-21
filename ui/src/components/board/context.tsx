import { createContext, useContext } from "react";
import type { Board, Note, Person } from "@/lib/retro";

export type BoardApi = {
  board: Board;
  people: Person[];
  me: string;
  gifSearch: boolean;
  ai: boolean;
  send: (name: string, args?: unknown) => Promise<void>;
  // run sends a command and reports a failure as a toast, for actions that
  // have nowhere better to show a problem.
  run: (name: string, args?: unknown) => Promise<boolean>;
  editNote: (note: Note | null, columnId?: string) => void;
  moveNote: (note: Note) => void;
  // dragging is the note being dragged right now, so drop zones can show.
  dragging: string | null;
  setDragging: (noteId: string | null) => void;
};

export const BoardContext = createContext<BoardApi | null>(null);

export function useBoard() {
  const b = useContext(BoardContext);
  if (!b) throw new Error("useBoard outside a board");
  return b;
}

export const NOTE_TYPE = "application/x-thoughts-note";

export function noteById(board: Board, id: string) {
  for (const g of board.groups) {
    const n = g.notes.find((x) => x.id === id);
    if (n) return { note: n, group: g };
  }
  return null;
}
