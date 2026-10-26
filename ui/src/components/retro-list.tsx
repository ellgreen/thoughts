import { Link } from "@tanstack/react-router";
import type { RetroSummary } from "@/lib/retro";
import { stages } from "@/lib/retro";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function RetroList({ retros }: { retros: RetroSummary[] }) {
  return (
    <ol className="flex flex-col border-t-[2.5px] border-ink">
      {retros.map((r) => (
        <li key={r.id} className="border-b-[2.5px] border-ink">
          <Link
            to="/retros/$retroId"
            params={{ retroId: r.id }}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 px-1 py-4 hover:bg-blue-tint sm:grid-cols-[minmax(0,1fr)_8rem_10rem_8rem]"
          >
            <span className="font-display text-2xl leading-tight">{r.title}</span>
            <span className="text-right font-semibold sm:text-left">{stages.find((s) => s.id === r.stage)?.label}</span>
            <span className="text-ink-soft">
              {r.notes} {r.notes === 1 ? "thought" : "thoughts"}
              {r.actions > 0 && `, ${r.actionsDone} of ${r.actions} actions done`}
            </span>
            <span className="text-ink-soft sm:text-right">{dateFormat.format(new Date(r.createdAt))}</span>
            {r.tags.length > 0 && (
              <span className="col-span-full flex flex-wrap gap-x-3 text-sm font-semibold text-ink-soft">
                {r.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
