import { Link } from "@tanstack/react-router";
import type { RetroSummary, Stage } from "@/lib/retro";
import { stages } from "@/lib/retro";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const DAY = 24 * 60 * 60 * 1000;

function when(iso: string) {
  const then = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(then).setHours(0, 0, 0, 0)) / DAY);
  return days === 0 ? "today" : days === 1 ? "yesterday" : dateFormat.format(then);
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function StageGlyph({ stage }: { stage: Stage }) {
  const at = stages.findIndex((s) => s.id === stage);
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {stages.map((s, i) => (
        <span key={s.id} className={`size-2.5 ${i <= at ? "bg-ink" : "border-[1.5px] border-ink-soft"}`} />
      ))}
    </span>
  );
}

function Row({ retro: r }: { retro: RetroSummary }) {
  const live = r.stage !== "discuss";
  const stage = stages.find((s) => s.id === r.stage)?.label;
  const meta = [
    r.tags.map((t) => `#${t}`).join(" "),
    count(r.notes, "thought", "thoughts"),
    r.actions > 0 && `${r.actionsDone} of ${count(r.actions, "action", "actions")} done`,
    when(r.createdAt),
  ].filter(Boolean);

  return (
    <li className="border-b-[1.5px] border-line">
      <Link
        to="/retros/$retroId"
        params={{ retroId: r.id }}
        viewTransition
        className="group flex items-center gap-4 py-4 transition-transform duration-150 hover:translate-x-1 focus-visible:translate-x-1"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="relative font-display text-2xl leading-tight">
            <span aria-hidden="true" className="absolute inset-0 translate-x-[0.045em] translate-y-[0.045em] text-pink opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
              {r.title}
            </span>
            <span className="relative" style={{ viewTransitionName: `retro-${r.id}` }}>
              {r.title}
            </span>
          </span>
          <span className="text-sm text-ink-soft">{meta.join(" · ")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          <span className={live ? "" : "sr-only"}>{stage}</span>
          <StageGlyph stage={r.stage} />
        </span>
      </Link>
    </li>
  );
}

function Section({ label, retros }: { label: string; retros: RetroSummary[] }) {
  if (retros.length === 0) return null;
  return (
    <section className="flex flex-col" aria-label={label}>
      <h2 className="border-b-[1.5px] border-line pb-2 text-xs font-bold tracking-widest text-ink-soft uppercase">{label}</h2>
      <ol className="flex flex-col">
        {retros.map((r) => (
          <Row key={r.id} retro={r} />
        ))}
      </ol>
    </section>
  );
}

export function RetroList({ retros }: { retros: RetroSummary[] }) {
  return (
    <div className="flex flex-col gap-8">
      <Section label="In progress" retros={retros.filter((r) => r.stage !== "discuss")} />
      <Section label="Earlier" retros={retros.filter((r) => r.stage === "discuss")} />
    </div>
  );
}
