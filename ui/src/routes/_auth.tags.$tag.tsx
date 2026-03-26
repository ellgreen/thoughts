import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RetroItem } from "@/components/retro/list";
import { api } from "@/lib/api";
import { Retro, Task } from "@/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArchiveIcon, CheckSquareIcon, FileTextIcon, TagIcon } from "lucide-react";
import { useState } from "react";

interface TagStats {
  retro_count: number;
  note_count: number;
  open_task_count: number;
}

interface OpenTaskItem extends Task {
  retro_title: string;
}

interface TagRetrosResponse {
  stats: TagStats;
  retros: Retro[];
  open_tasks: OpenTaskItem[];
}

export const Route = createFileRoute("/_auth/tags/$tag")({
  loader: async ({ params }) => {
    const res = await api.get<TagRetrosResponse>(`/api/tags/${encodeURIComponent(params.tag)}`);
    return res.data;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { stats, retros, open_tasks } = Route.useLoaderData();
  const [tasks, setTasks] = useState<OpenTaskItem[]>(open_tasks ?? []);

  async function completeTask(taskId: string) {
    await api.patch(`/api/tasks/${taskId}/complete`, { completed: true });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  return (
    <div className="max-w-[1600px] mx-auto px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground text-sm hover:text-foreground transition-colors">
          Home
        </Link>
        <span className="text-muted-foreground text-sm">/</span>
        <div className="flex items-center gap-2">
          <TagIcon className="size-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{tag}</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={ArchiveIcon} value={stats.retro_count} label="Retrospectives" gradient="from-violet-400 to-primary" />
        <StatCard icon={FileTextIcon} value={stats.note_count} label="Notes" gradient="from-sky-400 to-primary" />
        <StatCard icon={CheckSquareIcon} value={tasks.length} label="Open tasks" gradient="from-rose-400 to-primary" />
      </div>

      {/* Open tasks */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Open Tasks</CardTitle>
            <CardDescription>Incomplete tasks across all retros tagged with <Badge variant="outline" className="font-normal">{tag}</Badge></CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 mt-0.5 rounded-sm text-muted-foreground hover:text-foreground"
                    onClick={() => completeTask(task.id)}
                    title="Mark complete"
                  >
                    <CheckSquareIcon className="size-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{task.what}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {task.who && <span>@{task.who}</span>}
                      {task.when && (
                        <span>{new Date(task.when).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                      <span className="text-muted-foreground/60">·</span>
                      <span>{task.retro_title}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retros */}
      <Card>
        <CardHeader>
          <CardTitle>Retrospectives</CardTitle>
          <CardDescription>
            All retrospectives tagged with{" "}
            <Badge variant="outline" className="font-normal">{tag}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {retros.length === 0 ? (
            <p className="text-sm text-muted-foreground">No retrospectives found for this tag.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {retros.map((retro: Retro) => (
                <RetroItem key={retro.id} retro={retro} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  gradient,
}: {
  icon: typeof ArchiveIcon;
  value: number;
  label: string;
  gradient: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Icon className="size-5 text-muted-foreground shrink-0" />
        <div>
          <div className={`text-2xl font-black tracking-tight tabular-nums bg-linear-to-br ${gradient} bg-clip-text text-transparent`}>
            {value}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
