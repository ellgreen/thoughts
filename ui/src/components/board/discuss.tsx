import { useEffect, useState, type FormEvent } from "react";
import { Button, Checkbox, Input, Label, TextField, ToggleButton } from "react-aria-components";
import { button, input } from "@/components/ui";
import { Kbd, useShortcut } from "@/keys/keys";
import { formatDueOn, type Action } from "@/lib/retro";
import { Pile, Stamps } from "./columns";
import { useBoard } from "./context";
import { inkFor } from "./note";

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

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
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
          <Checkbox isSelected={follow} onChange={toggleFollow} className="group ml-auto flex min-h-11 items-center gap-2 text-sm font-semibold">
            <span className="flex size-5 shrink-0 items-center justify-center border-[2.5px] border-ink group-data-selected:bg-ink">
              <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-paper stroke-[2.5] opacity-0 group-data-selected:opacity-100" aria-hidden="true">
                <path d="M3 8.5l3 3 7-7" />
              </svg>
            </span>
            Follow the room
          </Checkbox>
        </div>
        <ol className="flex flex-col gap-8" aria-label="Groups by votes">
          {ranked.length === 0 && <p className="text-ink-soft">Nothing came up this time.</p>}
          {shown.map((g) => {
            const i = ranked.indexOf(g);
            const column = board.retro.columns.find((c) => c.id === g.columnId);
            const here = g.id === spot;
            return (
              <li
                key={g.id}
                data-spot={g.id}
                data-column-index={columnIndex.get(g.columnId)}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 ${here ? "-mx-3 bg-blue-tint/50 p-3" : ""} ${focus ? "text-lg" : ""}`}
              >
                <span className="font-display text-5xl leading-none" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-sm font-bold text-ink-soft">{column?.title}</span>
                    {here && <span className="bg-ink px-2 py-0.5 text-sm font-bold text-paper">Everyone's here</span>}
                    <Stamps count={g.votes ?? 0} label={`${g.votes ?? 0} ${g.votes === 1 ? "vote" : "votes"}`} size={26} />
                  </div>
                  <Pile group={g} ink={inkFor(columnIndex.get(g.columnId) ?? 0)} />
                  <Button onPress={() => run("spotlight.set", { groupId: here ? "" : g.id })} className={`${button.quiet} self-start px-0`}>
                    {here ? "Let everyone move on" : "Bring everyone here"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <Actions />
    </div>
  );
}

function Actions() {
  const { board, run } = useBoard();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  useShortcut({ id: "add-action", keys: "a", label: "Add an action", section: "Discuss", run: () => setAdding(true) });
  const open = board.actions.filter((a) => !a.done);
  const done = board.actions.filter((a) => a.done);

  return (
    <aside className="flex min-w-[min(100%,18rem)] flex-[1_1_22rem] flex-col gap-4 bg-pink-tint p-5 lg:sticky lg:top-4" aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="font-display text-3xl leading-tight">
        What we'll do
      </h2>
      {board.actions.length === 0 && !adding && <p>No actions yet. Add one for anything someone's going to do about what you've discussed.</p>}
      <ul className="flex flex-col">
        {[...open, ...done].map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <ActionForm action={a} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className="flex items-start gap-3 border-b-[2px] border-ink py-3">
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
          ),
        )}
      </ul>
      {adding ? (
        <ActionForm onDone={() => setAdding(false)} />
      ) : (
        <Button onPress={() => setAdding(true)} className={`${button.line} self-start`}>
          Add an action <Kbd keys="a" />
        </Button>
      )}
    </aside>
  );
}

function ActionForm({ action, onDone }: { action?: Action; onDone: () => void }) {
  const { run } = useBoard();
  const [what, setWhat] = useState(action?.what ?? "");
  const [who, setWho] = useState(action?.who ?? "");
  const [dueOn, setDueOn] = useState(action?.dueOn ?? "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(action ? "action.update" : "action.add", { id: action?.id, what, who, dueOn });
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-[2.5px] border-ink bg-paper p-3">
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
          {action ? "Save" : "Add it"}
        </Button>
        {action && (
          <Button
            onPress={async () => {
              if (await run("action.delete", { id: action.id })) onDone();
            }}
            className={button.quiet}
          >
            Delete
          </Button>
        )}
        <Button onPress={onDone} className={button.quiet}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
