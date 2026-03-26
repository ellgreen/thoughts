import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "@tanstack/react-router";
import { Retro, RetroStatus } from "@/types";
import { CircleCheck, StickyNote } from "lucide-react";

const statusLabel: Record<RetroStatus, string> = {
  brainstorm: "Brainstorm",
  group: "Grouping",
  vote: "Voting",
  discuss: "Discuss",
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

export function RetroItem({ retro }: { retro: Retro }) {
  const navigate = useNavigate();
  const allTasksDone =
    retro.task_count > 0 && retro.task_count === retro.task_completed_count;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate({ to: "/retros/$retroId", params: { retroId: retro.id } })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate({ to: "/retros/$retroId", params: { retroId: retro.id } });
        }
      }}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Title + status */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-tight">{retro.title}</span>
        <Badge variant="outline" className="shrink-0 text-xs font-normal text-muted-foreground">
          {statusLabel[retro.status]}
        </Badge>
      </div>

      {/* Tags */}
      {retro.tags && retro.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {retro.tags.map((tag) => (
            <Link
              key={tag}
              to="/tags/$tag"
              params={{ tag }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
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
    </div>
  );
}
