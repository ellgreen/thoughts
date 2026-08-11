import { Badge } from "@/components/ui/badge";
import { accentForIndex } from "@/lib/column-accent";
import { cardVariants, spring, stagger } from "@/lib/motion";
import { stageLabel } from "@/lib/stages";
import { Retro, RetroStatus } from "@/types";
import { Link, useNavigate } from "@tanstack/react-router";
import { CircleCheck, StickyNote, Telescope } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

const statusAccent: Record<RetroStatus, string> = {
  brainstorm: accentForIndex(0),
  group: accentForIndex(1),
  vote: accentForIndex(3),
  discuss: accentForIndex(2),
};

export default function List({ retros }: { retros?: Retro[] }) {
  if (!retros || retros.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-14 text-center">
        <Telescope className="size-6 text-muted-foreground/60" />
        <p className="font-medium">No retros yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Start one above and share the link. Everyone joins by typing their
          name.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {retros.map((retro, i) => (
          <RetroItem key={retro.id} retro={retro} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function RetroItem({
  retro,
  index = 0,
}: {
  retro: Retro;
  index?: number;
}) {
  const navigate = useNavigate();
  const allTasksDone =
    retro.task_count > 0 && retro.task_count === retro.task_completed_count;

  function open() {
    navigate({ to: "/retros/$retroId", params: { retroId: retro.id } });
  }

  return (
    <m.div
      layout
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stagger(index)}
      whileHover={{ y: -2 }}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl bg-surface-raised p-4 pl-5 ring-1 ring-border/70 transition-shadow hover:shadow-[0_8px_28px_-10px_rgb(0_0_0/0.25)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: statusAccent[retro.status] }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="leading-tight font-medium">{retro.title}</span>
        <Badge
          variant="outline"
          className="shrink-0 text-xs font-normal text-muted-foreground"
        >
          {stageLabel(retro.status)}
        </Badge>
      </div>

      {retro.tags && retro.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {retro.tags.map((tag) => (
            <Link
              key={tag}
              to="/tags/$tag"
              params={{ tag }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <StickyNote className="size-3.5" />
            {retro.note_count}
          </span>
          {retro.task_count > 0 && (
            <m.span
              className={`flex items-center gap-1 ${allTasksDone ? "font-medium text-foreground" : ""}`}
              animate={allTasksDone ? { scale: [1, 1.08, 1] } : {}}
              transition={spring}
            >
              <CircleCheck className="size-3.5" />
              {retro.task_completed_count}/{retro.task_count}
            </m.span>
          )}
        </div>
        <span>{new Date(retro.created_at).toLocaleDateString()}</span>
      </div>
    </m.div>
  );
}
