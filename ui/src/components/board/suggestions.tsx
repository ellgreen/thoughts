import { useState } from "react";
import { Button } from "react-aria-components";
import { button } from "@/components/ui";
import { Thinking } from "@/components/thinking";
import { Kbd, useShortcut } from "@/keys/keys";
import type { Suggestion } from "@/lib/retro";
import { useBoard } from "./context";

type Kind = "groups" | "names" | "actions" | "recap";

const asks: Record<Kind, { label: string; busy: string }> = {
  groups: { label: "Suggest groups", busy: "Reading the notes…" },
  names: { label: "Name the groups", busy: "Naming groups…" },
  actions: { label: "Draft actions", busy: "Drafting actions…" },
  recap: { label: "Write a recap", busy: "Writing the recap…" },
};

// AIPanel is only shown on installs with an AI driver. Nothing it suggests
// changes the board until someone in the room applies it.
export function AIPanel() {
  const { board, send } = useBoard();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [problem, setProblem] = useState<{ kind: Kind; message: string } | null>(null);
  const stage = board.retro.stage;
  const kinds: Kind[] = stage === "group" ? ["groups", "names"] : stage === "discuss" ? ["actions", "recap"] : [];

  async function ask(kind: Kind) {
    if (busy) return;
    setBusy(kind);
    setProblem(null);
    try {
      await send("ai.suggest", { kind });
    } catch (e) {
      setProblem({ kind, message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }
  useShortcut(
    { id: "ai-suggest", keys: "s", label: stage === "group" ? "Suggest groups" : "Draft actions", section: "AI", run: () => ask(kinds[0]) },
    kinds.length > 0,
  );

  if (kinds.length === 0 && board.suggestions.length === 0) return null;

  return (
    <section aria-label="AI suggestions" className="flex flex-col gap-3">
      {kinds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {kinds.map((k, i) => (
            <Button key={k} onPress={() => ask(k)} isDisabled={busy !== null && busy !== k} className={button.line}>
              {busy === k ? <Thinking label={asks[k].busy} /> : k === "recap" && board.retro.recap ? "Rewrite the recap" : asks[k].label}
              {i === 0 && busy !== k && <Kbd keys="s" />}
            </Button>
          ))}
          <span className="text-sm text-ink-soft">The AI only sees the notes, never who wrote them.</span>
        </div>
      )}
      {problem && (
        <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-alert px-4 py-2">
          <p className="min-w-0 flex-1 font-semibold">{problem.message}</p>
          {kinds.includes(problem.kind) && (
            <Button onPress={() => ask(problem.kind)} className={button.quiet}>
              Try again
            </Button>
          )}
          <Button onPress={() => setProblem(null)} className={button.quiet}>
            Dismiss
          </Button>
        </div>
      )}
      {board.suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} />
      ))}
    </section>
  );
}

function SuggestionCard({ suggestion: s }: { suggestion: Suggestion }) {
  const { board, run } = useBoard();
  const notes = new Map(board.groups.flatMap((g) => g.notes.map((n) => [n.id, n.content ?? ""] as const)));
  const groupLabel = (id: string) => {
    const g = board.groups.find((x) => x.id === id);
    return g?.title || g?.notes[0]?.content || "A group";
  };
  const n = s.items.length;
  const heading = {
    groups: n === 1 ? "1 group suggested" : `${n} groups suggested`,
    names: n === 1 ? "A name for 1 group" : `Names for ${n} groups`,
    actions: n === 1 ? "1 action drafted" : `${n} actions drafted`,
  }[s.kind];
  const rows =
    s.kind === "groups"
      ? s.items.map((g) => ({ title: g.title, detail: g.noteIds.map((id) => `“${notes.get(id) ?? "…"}”`).join(", ") }))
      : s.kind === "names"
        ? s.items.map((x) => ({ title: x.title, detail: `For “${groupLabel(x.groupId)}”` }))
        : s.items.map((x) => ({ title: x.what, detail: x.groupId && `From “${groupLabel(x.groupId)}”` }));

  return (
    <article className="flex flex-col gap-3 border-[2.5px] border-ink bg-paper p-4" aria-label={heading}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl leading-tight">{heading}</h2>
        <span className="text-sm text-ink-soft">Everyone can see this. Nothing changes until someone applies it.</span>
      </div>
      <ul className="flex flex-col divide-y divide-ink/20">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
              <span className="font-bold">{row.title}</span>
              {row.detail && <span className="text-sm text-ink-soft">{row.detail}</span>}
            </div>
            <div className="flex gap-1">
              <Button onPress={() => run("ai.apply", { id: s.id, item: i })} className={button.line}>
                {s.kind === "actions" ? "Add" : "Apply"}
              </Button>
              <Button onPress={() => run("ai.dismiss", { id: s.id, item: i })} className={button.quiet}>
                Dismiss
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button onPress={() => run("ai.apply", { id: s.id })} className={button.solid}>
            {s.kind === "actions" ? "Add all" : "Apply all"}
          </Button>
          <Button onPress={() => run("ai.dismiss", { id: s.id })} className={button.quiet}>
            Dismiss all
          </Button>
        </div>
      )}
    </article>
  );
}

export function RecapBlock() {
  const { board } = useBoard();
  if (!board.retro.recap) return null;
  return (
    <section aria-labelledby="recap-heading" className="max-w-[70ch] bg-blue-tint p-5">
      <h2 id="recap-heading" className="font-display text-2xl">
        Recap
      </h2>
      <p className="mt-2 text-lg leading-relaxed">{board.retro.recap}</p>
    </section>
  );
}
