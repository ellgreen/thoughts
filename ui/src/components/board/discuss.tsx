import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, Checkbox, Input, Label, TextField, ToggleButton } from "react-aria-components";
import { motion } from "motion/react";
import { enter, move } from "@/components/motion";
import { Sheet } from "@/components/dialog";
import { IconButton } from "@/components/icon-button";
import { Icon } from "@/components/icons";
import { button, input } from "@/components/ui";
import { Kbd, useShortcut } from "@/keys/keys";
import { formatDueOn, type Action } from "@/lib/retro";
import { useChanges } from "./changes";
import { Pile, Stamps } from "./columns";
import { useBoard } from "./context";
import { DockSlot } from "./dock";
import { inkFor } from "./note";

// WIDE is Tailwind's lg breakpoint, where the actions panel sits beside the
// groups instead of in a sheet.
const WIDE = "(min-width: 64rem)";

function onWide(fn: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
}

function readFollow() {
  try {
    return localStorage.getItem("thoughts.follow") !== "off";
  } catch {
    return true;
  }
}

export function Discuss() {
  const { board, run } = useBoard();
  const columnIndex = new Map(board.retro.columns.map((c, i) => [c.id, i]));
  const ranked = [...board.groups].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const [follow, setFollow] = useState(readFollow);
  const [focus, setFocus] = useState(false);
  const spot = board.spotlight;
  const at = ranked.findIndex((g) => g.id === spot);

  useEffect(() => {
    if (!follow || !spot) return;
    document.querySelector(`[data-spot="${CSS.escape(spot)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [spot, follow]);

  function toggleFollow(on: boolean) {
    setFollow(on);
    try {
      localStorage.setItem("thoughts.follow", on ? "on" : "off");
    } catch {
      // Remembering is a nicety.
    }
  }

  const current = Math.max(at, 0);
  const last = current >= ranked.length - 1;
  const step = (d: number) => {
    const next = ranked[current + d];
    if (next) run("spotlight.set", { groupId: next.id });
  };
  useShortcut({ id: "prev-group", keys: "left", label: "Previous group", section: "Discuss", run: () => step(-1) }, focus && current > 0);
  useShortcut({ id: "next-group", keys: "right", label: "Next group", section: "Discuss", run: () => step(1) }, focus && !last);
  const shown = focus ? ranked.slice(current, current + 1) : ranked;
  const voted = ranked.filter((g) => (g.votes ?? 0) > 0).length;
  const wide = useSyncExternalStore(onWide, () => window.matchMedia(WIDE).matches);
  const change = useChanges().stage;
  const [arrived] = useState(() => change?.to === "discuss");

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-6">
        <DockSlot>
          <ToggleButton isSelected={focus} onChange={setFocus} className={`${button.line} data-selected:bg-ink data-selected:text-paper`}>
            One at a time
          </ToggleButton>
          {focus && ranked.length > 0 && (
            <>
              <Button onPress={() => step(-1)} isDisabled={current === 0} className={`${button.quiet} disabled:opacity-40`}>
                <Kbd keys="left" /> Previous
              </Button>
              <span className="text-sm font-bold tabular-nums" aria-live="polite">
                {last ? `Last of ${ranked.length}` : `${current + 1} of ${ranked.length}`}
              </span>
              {last ? (
                <Button onPress={() => setFocus(false)} className={button.quiet}>
                  Show all groups
                </Button>
              ) : (
                <Button onPress={() => step(1)} className={button.quiet}>
                  Next <Kbd keys="right" />
                </Button>
              )}
            </>
          )}
          <Checkbox isSelected={follow} onChange={toggleFollow} className="group flex min-h-11 items-center gap-2 text-sm font-semibold">
            <span className="flex size-5 shrink-0 items-center justify-center border-[2.5px] border-ink group-data-selected:bg-ink">
              <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-paper stroke-[2.5] opacity-0 group-data-selected:opacity-100" aria-hidden="true">
                <path d="M3 8.5l3 3 7-7" />
              </svg>
            </span>
            Follow the room
          </Checkbox>
        </DockSlot>
        <ol className="flex flex-col gap-8" aria-label="Groups by votes">
          {ranked.length === 0 && <p className="text-ink-soft">Nothing came up this time.</p>}
          {shown.map((g) => {
            const i = ranked.indexOf(g);
            const column = board.retro.columns.find((c) => c.id === g.columnId);
            const here = g.id === spot;
            const hasVotes = (g.votes ?? 0) > 0;
            return (
              <li key={g.id} data-spot={g.id} data-column-index={columnIndex.get(g.columnId)} className={`flex flex-col gap-3 ${focus ? "text-lg" : ""}`}>
                {!focus && !hasVotes && i === voted && voted > 0 && <p className="border-t-[1.5px] border-line pt-4 text-sm font-bold text-ink-soft">No votes</p>}
                <div className={`relative isolate ${hasVotes ? "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3" : ""}`}>
                  {here && <motion.div layoutId="spot" transition={move} className="absolute -inset-3 -z-10 bg-blue-tint/50" />}
                  {hasVotes && (
                    <motion.span
                      initial={arrived ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...enter, delay: 0.35 }}
                      className="font-display text-5xl leading-none"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </motion.span>
                  )}
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-bold text-ink-soft">{column?.title}</span>
                      {here && (
                        <span className="inline-flex items-center bg-ink pl-2 text-sm font-bold text-paper">
                          Everyone's here
                          <Button onPress={() => run("spotlight.set", { groupId: "" })} aria-label="Let everyone move on" className="inline-flex size-9 items-center justify-center">
                            <Icon name="close" className="size-4" />
                          </Button>
                        </span>
                      )}
                      <Stamps count={g.votes ?? 0} label={`${g.votes ?? 0} ${g.votes === 1 ? "vote" : "votes"}`} size={26} land={arrived ? 0.3 + Math.min(i, 12) * 0.04 : undefined} />
                      {!here && <IconButton icon="target" label="Bring everyone here" onPress={() => run("spotlight.set", { groupId: g.id })} className={hasVotes ? "" : "ml-auto"} />}
                    </div>
                    <Pile group={g} ink={inkFor(columnIndex.get(g.columnId) ?? 0)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {wide ? <Actions /> : <PhoneActions />}
    </div>
  );
}

function PhoneActions() {
  const { board } = useBoard();
  const [open, setOpen] = useState(false);
  return (
    <>
      <DockSlot>
        <Button onPress={() => setOpen(true)} className={button.line}>
          Actions ({board.actions.filter((a) => !a.done).length})
        </Button>
      </DockSlot>
      <Sheet isOpen={open} onOpenChange={setOpen} title="What we'll do">
        <Actions bare />
      </Sheet>
    </>
  );
}

function Actions({ bare }: { bare?: boolean }) {
  const { board, run } = useBoard();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const add = useRef<HTMLInputElement>(null);
  useShortcut({ id: "add-action", keys: "a", label: "Add an action", section: "Discuss", run: () => add.current?.focus() });
  const open = board.actions.filter((a) => !a.done);
  const done = board.actions.filter((a) => a.done);

  async function quickAdd(e: FormEvent) {
    e.preventDefault();
    const what = draft.trim();
    if (!what) return;
    setDraft("");
    if (!(await run("action.add", { what, who: "", dueOn: "" }))) setDraft((now) => now || what);
  }

  const row = (a: Action) =>
    editing === a.id ? (
      <li key={a.id}>
        <ActionForm action={a} onDone={() => setEditing(null)} />
      </li>
    ) : (
      <li key={a.id} className="flex items-start gap-3 border-b-[1.5px] border-line py-3">
        <Checkbox
          isSelected={a.done}
          onChange={(checked) => run("action.done", { id: a.id, done: checked })}
          aria-label={`Done: ${a.what}`}
          className="group mt-0.5 flex size-11 shrink-0 items-center justify-center"
        >
          <span className="flex size-6 items-center justify-center border-[2.5px] border-ink group-data-selected:bg-ink">
            <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-paper stroke-[2.5] opacity-0 group-data-selected:opacity-100" aria-hidden="true">
              <path d="M3 8.5l3 3 7-7" />
            </svg>
          </span>
        </Checkbox>
        <div className={`flex min-w-0 flex-1 flex-col ${a.done ? "line-through opacity-60" : ""}`}>
          <span className="font-semibold break-words">{a.what}</span>
          {(a.who || a.dueOn) && <span className="text-sm">{[a.who, a.dueOn && `by ${formatDueOn(a.dueOn)}`].filter(Boolean).join(", ")}</span>}
        </div>
        <Button onPress={() => setEditing(a.id)} className="min-h-11 px-2 text-sm font-semibold underline-offset-4 hover:underline">
          Edit
        </Button>
      </li>
    );

  const content = (
    <>
      {board.retro.recap && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold">Recap</h3>
          <p className="leading-relaxed">{board.retro.recap}</p>
        </div>
      )}
      <form onSubmit={quickAdd}>
        <input
          ref={add}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
          aria-label="Add an action"
          placeholder="Add an action"
          className={input}
        />
      </form>
      {board.actions.length === 0 && <p>No actions yet. Add one for anything someone's going to do about what you've discussed.</p>}
      {open.length > 0 && <ul className="flex flex-col">{open.map(row)}</ul>}
      {done.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Done ({done.length})</summary>
          <ul className="flex flex-col">{done.map(row)}</ul>
        </details>
      )}
    </>
  );

  if (bare) return <div className="flex flex-col gap-4">{content}</div>;
  return (
    <aside className="flex min-w-[min(100%,18rem)] flex-[1_1_22rem] flex-col gap-4 bg-pink-tint p-5 lg:sticky lg:top-20" aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="text-2xl leading-tight font-bold">
        What we'll do
      </h2>
      {content}
    </aside>
  );
}

function ActionForm({ action, onDone }: { action: Action; onDone: () => void }) {
  const { run } = useBoard();
  const [what, setWhat] = useState(action.what);
  const [who, setWho] = useState(action.who);
  const [dueOn, setDueOn] = useState(action.dueOn);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run("action.update", { id: action.id, what, who, dueOn });
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-[1.5px] border-ink bg-paper p-3">
      <TextField value={what} onChange={setWhat} isRequired autoFocus className="flex flex-col gap-1">
        <Label className="font-bold">What's going to happen?</Label>
        <Input className={input} />
      </TextField>
      <div className="flex flex-wrap gap-3">
        <TextField value={who} onChange={setWho} className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1">
          <Label className="font-bold">Who</Label>
          <Input className={input} />
        </TextField>
        <TextField value={dueOn} onChange={setDueOn} type="date" className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1">
          <Label className="font-bold">By</Label>
          <Input className={input} />
        </TextField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className={button.solid}>
          Save
        </Button>
        <Button
          onPress={async () => {
            if (await run("action.delete", { id: action.id })) onDone();
          }}
          className={button.quiet}
        >
          Delete
        </Button>
        <Button onPress={onDone} className={button.quiet}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
