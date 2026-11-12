import { useState } from "react";
import { Button, ToggleButton } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { IconButton } from "@/components/icon-button";
import { button } from "@/components/ui";
import { Kbd, useShortcut } from "@/keys/keys";
import { formatDueOn } from "@/lib/retro";
import { useBoard } from "./context";

export function ReadyCheck() {
  const { board, people, me, run } = useBoard();
  const ready = new Set(board.ready);
  const mine = ready.has(me);
  const here = people.filter((p) => ready.has(p.id)).length;
  useShortcut({ id: "ready", keys: "d", label: "Say you're done with this stage", section: "Retro", run: () => run("ready.set", { ready: !mine }) });
  const waiting = people.filter((p) => !ready.has(p.id)).map((p) => p.name);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleButton
        isSelected={mine}
        onChange={(on) => run("ready.set", { ready: on })}
        className={`${button.line} data-selected:bg-ink data-selected:text-paper`}
      >
        {mine ? "Done" : "I'm done"} <Kbd keys="d" />
      </ToggleButton>
      <span className="text-sm font-semibold whitespace-nowrap" aria-live="polite" title={waiting.length ? `Still going: ${waiting.join(", ")}` : undefined}>
        {here} of {people.length} done
      </span>
    </div>
  );
}

export function LastTime() {
  const { board, run } = useBoard();
  const [open, setOpen] = useState(false);
  const n = board.lastTime.length;
  const stage = board.retro.stage;
  if (n === 0 || (stage !== "reflect" && stage !== "discuss")) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
      {n} {n === 1 ? "action" : "actions"} still open from last time
      <Button onPress={() => setOpen(true)} className={`${button.quiet} underline`}>
        Settle them
      </Button>
      <Sheet isOpen={open} onOpenChange={setOpen} title="From last time">
        <p className="text-base font-normal text-ink-soft">Still open from earlier {board.team?.name} retros. Mark each one done, carry it into this retro, or drop it.</p>
        <ul className="flex flex-col text-base font-normal">
          {board.lastTime.map((a) => (
            <li key={a.id} className="flex items-center gap-x-3 border-t-[1.5px] border-line py-2">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{a.what}</span>
                <span className="block text-sm text-ink-soft">{[a.who, a.dueOn && `by ${formatDueOn(a.dueOn)}`, `from ${a.retroTitle}`].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex">
                <IconButton icon="check" label="Done" onPress={() => run("lastTime.close", { id: a.id, outcome: "done" })} />
                <IconButton icon="arrowRight" label="Carry over" onPress={() => run("lastTime.close", { id: a.id, outcome: "carried" })} />
                <IconButton icon="close" label="Drop" onPress={() => run("lastTime.close", { id: a.id, outcome: "dropped" })} />
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
