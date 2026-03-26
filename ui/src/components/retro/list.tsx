import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route as RetrosRoute } from "@/routes/_auth.retros.$retroId";
import { Retro, RetroStatus } from "@/types";
import { Link } from "@tanstack/react-router";
import { CircleCheck, StickyNote } from "lucide-react";

const statusLabel: Record<RetroStatus, string> = {
  brainstorm: "Brainstorm",
  group: "Grouping",
  vote: "Voting",
  discuss: "Discuss",
};

const statusVariant: Record<RetroStatus, "default" | "secondary" | "outline"> = {
  brainstorm: "outline",
  group: "outline",
  vote: "secondary",
  discuss: "default",
};

export default function List({ retros }: { retros?: Retro[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Retros</CardTitle>
        <CardDescription>Your last {retros?.length ?? 0} retrospectives</CardDescription>
      </CardHeader>

      <CardContent>
        {!retros || retros.length === 0 ? (
          <p className="text-muted-foreground text-sm">No retros yet 😢</p>
        ) : (
          <div className="flex flex-col gap-2">
            {retros.map((retro) => (
              <RetroItem key={retro.id} retro={retro} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RetroItem({ retro }: { retro: Retro }) {
  const allTasksDone =
    retro.task_count > 0 && retro.task_count === retro.task_completed_count;

  return (
    <div className="relative">
      <Link
        to={RetrosRoute.path}
        params={{ retroId: retro.id }}
        className="group flex flex-col gap-3 rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-tight">{retro.title}</span>
          <Badge variant={statusVariant[retro.status]} className="shrink-0 text-xs">
            {statusLabel[retro.status]}
          </Badge>
        </div>

        {/* Footer stats + date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <StickyNote className="size-3.5" />
              {retro.note_count} notes
            </span>
            {retro.task_count > 0 && (
              <span className={`flex items-center gap-1 ${allTasksDone ? "font-medium" : ""}`}>
                <CircleCheck className="size-3.5" />
                {retro.task_completed_count}/{retro.task_count} tasks
              </span>
            )}
          </div>
          <span>{new Date(retro.created_at).toLocaleDateString()}</span>
        </div>
      </Link>
    </div>
  );
}
