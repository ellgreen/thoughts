import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, Checkbox, Input, Label, TextField } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { button, input } from "@/components/ui";
import { Thinking } from "@/components/thinking";
import { messageOf } from "@/lib/api";
import { cleanTag, createRetro, tagsQuery, templates, themedTemplate } from "@/lib/retro";
import { meQuery } from "@/lib/session";
import { TeamPicker } from "./team-picker";

type Col = { key: number; title: string; description: string };

let nextKey = 0;
const fromTemplate = (i: number): Col[] => templates[i].columns.map((c) => ({ ...c, key: ++nextKey }));

export function CreateRetro({ isOpen, onOpenChange, tag, teamId }: { isOpen: boolean; onOpenChange: (o: boolean) => void; tag?: string; teamId?: string }) {
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="New retro" wide>
      {(close) => <Form close={close} tag={tag} teamId={teamId} />}
    </Sheet>
  );
}

function Form({ close, tag, teamId: initialTeam }: { close: () => void; tag?: string; teamId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: known = [] } = useQuery(tagsQuery);
  const { data: me } = useQuery(meQuery);
  const ai = !!me?.features.ai;
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState(0);
  const [columns, setColumns] = useState<Col[]>(() => fromTemplate(0));
  const [tags, setTags] = useState(tag ? [tag] : []);
  const [tagDraft, setTagDraft] = useState("");
  const [unlisted, setUnlisted] = useState(false);
  const [teamId, setTeamId] = useState(initialTeam ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(i: number) {
    setTemplate(i);
    setColumns(fromTemplate(i));
  }

  function edit(key: number, patch: Partial<Col>) {
    setTemplate(-1);
    setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function addTag(raw: string) {
    const t = cleanTag(raw);
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagDraft("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const allTags = tagDraft.trim() ? [...tags, cleanTag(tagDraft)] : tags;
      const r = await createRetro({ title, columns: columns.map((c) => ({ title: c.title, description: c.description })), tags: allTags, unlisted, teamId });
      await queryClient.invalidateQueries({ queryKey: ["retros"] });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      close();
      await navigate({ to: "/retros/$retroId", params: { retroId: r.id } });
    } catch (err) {
      setProblem(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const suggestions = known.filter((t) => !tags.includes(t) && t.startsWith(cleanTag(tagDraft))).slice(0, 6);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <TextField value={title} onChange={setTitle} isRequired className="flex flex-col gap-2">
        <Label className="font-bold">What's this retro for?</Label>
        <Input className={input} placeholder="Sprint 41" />
      </TextField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-bold">Start from</legend>
        <div className="flex flex-wrap gap-2">
          {templates.map((t, i) => (
            <Button
              key={t.name}
              onPress={() => pick(i)}
              aria-pressed={template === i}
              className={`min-h-10 border-[2px] border-ink px-3 text-sm font-semibold ${template === i ? "bg-ink text-paper" : "hover:bg-blue-tint"}`}
            >
              {t.name}
            </Button>
          ))}
        </div>
        {ai && (
          <ThemeColumns
            onColumns={(cols) => {
              setTemplate(-1);
              setColumns(cols.map((c) => ({ ...c, key: ++nextKey })));
            }}
          />
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-bold">
          Columns <span className="font-normal text-ink-soft">({columns.length} of 5)</span>
        </legend>
        <ol className="flex flex-col gap-3">
          {columns.map((c, i) => (
            <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 bg-blue-tint p-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
              <TextField aria-label={`Column ${i + 1} title`} value={c.title} onChange={(v) => edit(c.key, { title: v })} isRequired className="col-start-1 row-start-1">
                <Input className={`${input} min-h-11 text-base`} />
              </TextField>
              <TextField
                aria-label={`Column ${i + 1} prompt`}
                value={c.description}
                onChange={(v) => edit(c.key, { description: v })}
                className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
              >
                <Input className={`${input} min-h-11 text-base`} placeholder="A question to prompt people" />
              </TextField>
              <Button
                aria-label={`Remove column ${i + 1}`}
                isDisabled={columns.length <= 2}
                onPress={() => {
                  setTemplate(-1);
                  setColumns(columns.filter((x) => x.key !== c.key));
                }}
                className={`${button.quiet} col-start-2 row-start-1 sm:col-start-3`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
        {columns.length < 5 && (
          <Button
            onPress={() => {
              setTemplate(-1);
              setColumns([...columns, { key: ++nextKey, title: "", description: "" }]);
            }}
            className={`${button.line} self-start`}
          >
            Add a column
          </Button>
        )}
      </fieldset>

      <TeamPicker value={teamId} onChange={setTeamId} />

      <div className="flex flex-col gap-2">
        <TextField value={tagDraft} onChange={setTagDraft} className="flex flex-col gap-2">
          <Label className="font-bold">
            Tags <span className="font-normal text-ink-soft">(a team or project, so you can find it later)</span>
          </Label>
          <Input
            className={input}
            placeholder="platform-team"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagDraft);
              } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                setTags(tags.slice(0, -1));
              }
            }}
          />
        </TextField>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Button key={t} onPress={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="min-h-9 bg-pink-tint px-3 text-sm font-semibold">
              #{t} <span aria-hidden="true">×</span>
            </Button>
          ))}
          {tagDraft &&
            suggestions.map((t) => (
              <Button key={t} onPress={() => addTag(t)} className="min-h-9 border-[1.5px] border-ink px-3 text-sm">
                Add #{t}
              </Button>
            ))}
        </div>
      </div>

      <Checkbox isSelected={unlisted} onChange={setUnlisted} className="group flex min-h-11 items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center border-[2.5px] border-ink group-data-selected:bg-ink">
          <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-paper stroke-[2.5] opacity-0 group-data-selected:opacity-100" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" />
          </svg>
        </span>
        <span>
          Keep it off the home page. <span className="text-ink-soft">Anyone with the link can still join.</span>
        </span>
      </Checkbox>

      {problem && (
        <p role="alert" className="bg-alert px-3 py-2 font-semibold">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" isDisabled={busy} className={button.solid}>
          {busy ? "Starting…" : "Start the retro"}
        </Button>
        <Button slot="close" className={button.quiet}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ThemeColumns isn't a nested <form>: Enter is caught here so it makes
// columns rather than submitting the whole retro.
function ThemeColumns({ onColumns }: { onColumns: (cols: { title: string; description: string }[]) => void }) {
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function make() {
    if (!theme.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      onColumns((await themedTemplate(theme)).columns);
    } catch (err) {
      setProblem(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-[2.5px] border-dashed border-ink p-3">
      <TextField value={theme} onChange={setTheme} className="flex flex-col gap-1">
        <Label className="font-semibold">Or make columns for a theme</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Formula 1, a heist film, the deep sea"
            className={`${input} min-w-0 flex-1`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                make();
              }
            }}
          />
          <Button onPress={make} isDisabled={!busy && !theme.trim()} className={button.line}>
            {busy ? <Thinking label="Making columns…" /> : "Make columns"}
          </Button>
        </div>
      </TextField>
      <p className="text-sm text-ink-soft">The AI writes the columns. You can change them before starting.</p>
      {problem && (
        <p role="alert" className="bg-alert px-3 py-2 text-sm font-semibold">
          {problem}
        </p>
      )}
    </div>
  );
}
