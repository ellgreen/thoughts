import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/toast";
import { useBoard } from "./context";
import { ReadyCheck } from "./facilitation";

const votingHint = "Votes can stack on one group. Totals show when you start discussing.";

export function Dock({ onSlot }: { onSlot: (el: HTMLElement | null) => void }) {
  const { board } = useBoard();
  const toast = useToast();
  const stage = board.retro.stage;
  const before = useRef(stage);

  useEffect(() => {
    if (before.current !== "vote" && stage === "vote") toast(votingHint);
    before.current = stage;
  }, [stage, toast]);

  return (
    <div data-dock className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center sm:p-3">
      <div className="pointer-events-auto flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t-[1.5px] border-ink bg-paper px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:w-auto sm:max-w-full sm:border-[1.5px] sm:pb-2">
        {stage !== "discuss" && <ReadyCheck />}
        {stage === "vote" && <VotesLeft />}
        <div ref={onSlot} className="flex flex-wrap items-center gap-2 empty:hidden" />
      </div>
    </div>
  );
}

function VotesLeft() {
  const { board } = useBoard();
  const { used, max } = board.votes;
  return (
    <span className="flex items-center gap-2" title={votingHint}>
      <span role="img" aria-label={`${max - used} of ${max} votes left`} className="flex flex-wrap gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`size-5 rounded-stamp ${i < max - used ? "bg-pink" : "border-[1.5px] border-ink-soft"}`} />
        ))}
      </span>
      <span className="text-sm font-semibold whitespace-nowrap">{max - used} left</span>
    </span>
  );
}

// DockSlot puts a stage's own controls in the dock from wherever their state
// lives.
export function DockSlot({ children }: { children: ReactNode }) {
  const { dockSlot } = useBoard();
  return dockSlot ? createPortal(children, dockSlot) : null;
}
