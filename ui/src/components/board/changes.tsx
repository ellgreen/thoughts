import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import type { Board, Stage } from "@/lib/retro";

export type StageChange = { from: Stage; to: Stage; n: number };

export type Changes = {
  // fresh are notes that were not on the previous frame's board.
  fresh: Set<string>;
  stage: StageChange | null;
  // reveal is each note's delay, in seconds, when reflect has just become group.
  reveal: Map<string, number> | null;
  // gone tells an exiting note or pile whether it was deleted or moved.
  gone: (id: string) => boolean;
};

const REVEAL = 0.26;
const BOARD_DONE = 0.6;
const BUSY = 120;

const none: Changes = { fresh: new Set(), stage: null, reveal: null, gone: () => false };
const ChangesContext = createContext<Changes>(none);

export const useChanges = () => useContext(ChangesContext);

function noteIds(b: Board) {
  return new Set(b.groups.flatMap((g) => g.notes.map((n) => n.id)));
}

function revealOrder(b: Board) {
  const others = b.groups.flatMap((g) => g.notes.filter((n) => !n.mine).map((n) => n.id));
  const step = Math.min(0.03, (BOARD_DONE - REVEAL) / Math.max(others.length - 1, 1));
  return new Map(others.map((id, i) => [id, i * step]));
}

function next(prev: Board, board: Board, last: Changes): Changes {
  const before = noteIds(prev);
  const now = noteIds(board);
  const groups = new Set(board.groups.map((g) => g.id));
  const moved = prev.retro.stage !== board.retro.stage;
  return {
    fresh: new Set([...now].filter((id) => !before.has(id))),
    stage: moved ? { from: prev.retro.stage, to: board.retro.stage, n: (last.stage?.n ?? 0) + 1 } : last.stage,
    reveal: moved ? (prev.retro.stage === "reflect" && board.retro.stage === "group" ? revealOrder(board) : null) : last.reveal,
    gone: (id) => !now.has(id) && !groups.has(id),
  };
}

function onVisibility(fn: () => void) {
  document.addEventListener("visibilitychange", fn);
  return () => document.removeEventListener("visibilitychange", fn);
}

export function ChangesProvider({ board, children }: { board: Board; children: ReactNode }) {
  const [prev, setPrev] = useState(board);
  const [changes, setChanges] = useState(none);
  if (board !== prev) {
    setPrev(board);
    setChanges(next(prev, board, changes));
  }
  const hidden = useSyncExternalStore(onVisibility, () => document.hidden);
  // Past this many notes, plain swaps beat a slow page.
  const busy = board.groups.reduce((n, g) => n + g.notes.length, 0) > BUSY;
  return (
    <ChangesContext.Provider value={changes}>
      <MotionConfig reducedMotion={hidden || busy ? "always" : "user"}>{children}</MotionConfig>
    </ChangesContext.Provider>
  );
}
