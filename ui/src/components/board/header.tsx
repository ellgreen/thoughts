import { useState } from "react";
import { Button, Checkbox, Input, Label, TextField, Tooltip, TooltipTrigger } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { button, input } from "@/components/ui";
import { Kbd } from "@/keys/keys";
import type { Status } from "@/lib/socket";
import { cleanTag, stages, type Stage } from "@/lib/retro";
import { TeamPicker } from "@/components/team-picker";
import { useBoard } from "./context";

export function BoardHeader({ status, onSettings, onStage }: { status: Status; onSettings: () => void; onStage: (to: Stage) => void }) {
  const { board } = useBoard();
  const r = board.retro;
  const at = stages.findIndex((s) => s.id === r.stage);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-4xl leading-tight break-words sm:text-5xl">{r.title}</h1>
          {(r.tags.length > 0 || board.team) && (
            <p className="flex flex-wrap gap-x-3 font-semibold text-ink-soft">
              {board.team && (
                <a href={`/t/${board.team.slug}`} className="text-ink hover:underline">
                  {board.team.name}
                </a>
              )}
              {r.tags.map((t) => (
                <a key={t} href={`/tags/${encodeURIComponent(t)}`} className="hover:underline">
                  #{t}
                </a>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Presence status={status} />
          {r.stage !== "reflect" && (
            <a href={`/api/retros/${r.id}/export.md`} className={button.quiet}>
              Export
            </a>
          )}
          <Button onPress={onSettings} className={button.quiet}>
            Settings
          </Button>
        </div>
      </div>

      <nav aria-label="Stages" className="flex flex-wrap items-center gap-2">
        <ol className="flex flex-wrap gap-1.5">
          {stages.map((s, i) => (
            <li key={s.id}>
              <span
                aria-current={i === at ? "step" : undefined}
                className={`inline-flex min-h-10 items-center border-[2.5px] border-ink px-3 font-bold ${i === at ? "bg-ink text-paper" : i < at ? "text-ink-soft" : ""}`}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="ml-auto flex flex-wrap gap-2">
          {at > 0 && (
            <Button onPress={() => onStage(stages[at - 1].id)} className={button.quiet}>
              Back to {stages[at - 1].label.toLowerCase()} <Kbd keys="[" />
            </Button>
          )}
          {at < stages.length - 1 && (
            <Button onPress={() => onStage(stages[at + 1].id)} className={button.solid}>
              {stages[at + 1].next} <Kbd keys="]" />
            </Button>
          )}
        </div>
      </nav>
      {r.stage === "vote" && (
        <p className="font-semibold" role="status">
          {board.votes.max - board.votes.used} of {board.votes.max} votes left. Votes can stack on one group. Totals show when you start discussing.
        </p>
      )}
      {status === "reconnecting" && (
        <p role="status" className="bg-alert px-3 py-2 font-semibold">
          Lost the connection. Reconnecting…
        </p>
      )}
    </header>
  );
}

function Presence({ status }: { status: Status }) {
  const { people } = useBoard();
  const shown = people.slice(0, 5);
  const label = `${people.length} here: ${people.map((p) => p.name).join(", ")}`;
  return (
    <TooltipTrigger delay={200}>
      <Button aria-label={label} className="flex min-h-11 items-center gap-2 px-1">
        <span className="isolate flex">
          {shown.map((p, i) => (
            <span
              key={p.id}
              aria-hidden="true"
              className={`overprint flex size-9 items-center justify-center rounded-stamp font-display text-sm text-ink ${i % 2 ? "bg-blue-tint" : "bg-pink-tint"}`}
              style={{ marginLeft: i ? -10 : 0 }}
            >
              {initials(p.name)}
            </span>
          ))}
        </span>
        <span className="text-sm font-semibold">{status === "open" ? `${people.length} here` : "Connecting…"}</span>
      </Button>
      <Tooltip className="max-w-xs border-[2.5px] border-ink bg-paper px-3 py-2 text-sm">{people.map((p) => p.name).join(", ") || "Nobody else yet"}</Tooltip>
    </TooltipTrigger>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const arriving: Record<Stage, string> = {
  reflect: "",
  group: "Every note is revealed to everyone, with names, and the room can start grouping them.",
  vote: "Notes stop moving. Everyone gets their votes to spend.",
  discuss: "Vote totals are revealed and groups are ranked by them.",
};

const leaving: Record<Stage, string> = {
  reflect: "",
  group: "Everyone's notes go back to being hidden from each other. Groups stay as they are.",
  vote: "Voting closes. Votes already cast are kept.",
  discuss: "Totals are hidden again and reactions close.",
};

export function StageConfirm({ to, onClose }: { to: Stage; onClose: () => void }) {
  const { board, send } = useBoard();
  const [problem, setProblem] = useState<string | null>(null);
  const forward = stages.findIndex((s) => s.id === to) > stages.findIndex((s) => s.id === board.retro.stage);
  const label = stages.find((s) => s.id === to)!.label;
  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={forward ? `Move everyone to ${label.toLowerCase()}?` : `Go back to ${label.toLowerCase()}?`}>
      <p>{forward ? arriving[to] : leaving[board.retro.stage]} Everyone in the retro sees the change straight away.</p>
      {problem && (
        <p role="alert" className="bg-alert px-3 py-2 font-semibold">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          autoFocus
          className={button.solid}
          onPress={async () => {
            try {
              await send("stage.set", { stage: to });
              onClose();
            } catch (e) {
              setProblem((e as Error).message);
            }
          }}
        >
          {forward ? `Move to ${label.toLowerCase()}` : `Go back`}
        </Button>
        <Button onPress={onClose} className={button.quiet}>
          Not yet
        </Button>
      </div>
    </Sheet>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const { board, send } = useBoard();
  const r = board.retro;
  const [title, setTitle] = useState(r.title);
  const [maxVotes, setMaxVotes] = useState(String(r.maxVotes));
  const [unlisted, setUnlisted] = useState(r.unlisted);
  const [tags, setTags] = useState(r.tags.join(", "));
  const [teamId, setTeamId] = useState(r.teamId);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    setProblem(null);
    try {
      await send("retro.update", { title, maxVotes: Number(maxVotes), unlisted, tags: tags.split(",").map(cleanTag).filter(Boolean), teamId });
      onClose();
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title="Retro settings" wide>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextField value={title} onChange={setTitle} isRequired className="flex flex-col gap-1">
          <Label className="font-bold">Title</Label>
          <Input className={input} />
        </TextField>
        <TextField value={maxVotes} onChange={setMaxVotes} type="number" className="flex flex-col gap-1">
          <Label className="font-bold">Votes per person</Label>
          <Input min={1} max={15} className={`${input} max-w-32`} />
        </TextField>
        <TeamPicker value={teamId} onChange={setTeamId} />
        <TextField value={tags} onChange={setTags} className="flex flex-col gap-1">
          <Label className="font-bold">Tags, separated by commas</Label>
          <Input className={input} />
        </TextField>
        <Checkbox isSelected={unlisted} onChange={setUnlisted} className="group flex min-h-11 items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center border-[2.5px] border-ink group-data-selected:bg-ink">
            <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-paper stroke-[2.5] opacity-0 group-data-selected:opacity-100" aria-hidden="true">
              <path d="M3 8.5l3 3 7-7" />
            </svg>
          </span>
          Keep it off the home page
        </Checkbox>
        {problem && (
          <p role="alert" className="bg-alert px-3 py-2 font-semibold">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className={button.solid}>
            Save
          </Button>
          <Button onPress={onClose} className={button.quiet}>
            Cancel
          </Button>
        </div>
      </form>
      <ColumnSettings />
    </Sheet>
  );
}

function ColumnSettings() {
  const { board, run } = useBoard();
  const [title, setTitle] = useState("");
  return (
    <section className="flex flex-col gap-3 border-t-[2.5px] border-ink pt-5">
      <h3 className="font-display text-2xl">Columns</h3>
      <ul className="flex flex-col gap-2">
        {board.retro.columns.map((c) => (
          <ColumnRow key={c.id} id={c.id} title={c.title} description={c.description} canRemove={board.retro.columns.length > 2} />
        ))}
      </ul>
      {board.retro.columns.length < 5 && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("column.add", { title, description: "" })) setTitle("");
          }}
        >
          <TextField aria-label="New column title" value={title} onChange={setTitle} className="flex-1">
            <Input placeholder="New column" className={input} />
          </TextField>
          <Button type="submit" className={button.line}>
            Add column
          </Button>
        </form>
      )}
    </section>
  );
}

function ColumnRow({ id, title, description, canRemove }: { id: string; title: string; description: string; canRemove: boolean }) {
  const { run } = useBoard();
  const [t, setT] = useState(title);
  const [d, setD] = useState(description);
  const changed = t !== title || d !== description;
  return (
    <li className="flex flex-wrap items-center gap-2 bg-blue-tint p-2">
      <TextField aria-label="Column title" value={t} onChange={setT} className="min-w-0 flex-[1_1_10rem]">
        <Input className={`${input} min-h-11 text-base`} />
      </TextField>
      <TextField aria-label="Column prompt" value={d} onChange={setD} className="min-w-0 flex-[2_1_14rem]">
        <Input className={`${input} min-h-11 text-base`} placeholder="Prompt" />
      </TextField>
      {changed && (
        <Button onPress={() => run("column.update", { id, title: t, description: d })} className={button.line}>
          Save
        </Button>
      )}
      {canRemove && (
        <Button onPress={() => run("column.delete", { id })} className={button.quiet}>
          Remove
        </Button>
      )}
    </li>
  );
}
