import { useState, type KeyboardEvent } from "react";
import { Button, Checkbox, Input, Label, TextField } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { IconButton } from "@/components/icon-button";
import { button, input } from "@/components/ui";
import { cleanTag, stages, type Stage } from "@/lib/retro";
import { TeamPicker } from "@/components/team-picker";
import { useBoard } from "./context";

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
        aria-labelledby="settings-retro"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h3 id="settings-retro" className="text-xl font-bold">
          This retro
        </h3>
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
    <section className="flex flex-col gap-3 border-t-[1.5px] border-line pt-5">
      <h3 className="text-xl font-bold">Columns</h3>
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
  const save = () => {
    if (t !== title || d !== description) run("column.update", { id, title: t, description: d });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur();
  return (
    <li className="flex flex-wrap items-center gap-2 border-b-[1.5px] border-line pb-2">
      <TextField aria-label="Column title" value={t} onChange={setT} className="min-w-0 flex-[1_1_10rem]">
        <Input onBlur={save} onKeyDown={onKeyDown} className={`${input} min-h-11 text-base`} />
      </TextField>
      <TextField aria-label="Column prompt" value={d} onChange={setD} className="min-w-0 flex-[2_1_14rem]">
        <Input onBlur={save} onKeyDown={onKeyDown} className={`${input} min-h-11 text-base`} placeholder="Prompt" />
      </TextField>
      {canRemove && <IconButton icon="trash" label={`Remove ${title || "this column"}`} onPress={() => run("column.delete", { id })} />}
    </li>
  );
}
