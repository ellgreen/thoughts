import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route as RetrosRoute } from "@/routes/_auth.retros.$retroId";
import { Retro } from "@/types";
import { Link } from "@tanstack/react-router";
import { Badge } from "../ui/badge";
import { CircleCheck, StickyNote } from "lucide-react";

export default function List({ retros }: { retros?: Retro[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Retros</CardTitle>
      </CardHeader>

      <CardContent>
        {!retros || retros.length === 0 ? (
          <p className="text-foreground">No retros found 😢</p>
        ) : (
          <ul className="space-y-2">
            {retros.map((retro) => (
              <RetroItem key={retro.id} retro={retro} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const btnClasses =
  "ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

function RetroItem({ retro }: { retro: Retro }) {
  return (
    <li>
      <Link
        to={RetrosRoute.path}
        params={{ retroId: retro.id }}
        className={`block w-full space-y-3 p-2 rounded-lg border bg-card text-card-foreground shadow-sm
          hover:bg-accent hover:text-accent-foreground ${btnClasses}`}
      >
        <div className="w-full flex items-center justify-between">
          <h3>{retro.title}</h3>
          <Badge variant="outline">
            {new Date(retro.created_at).toLocaleDateString()}
          </Badge>
        </div>

        <ul className="w-full flex items-center space-x-4 text-sm text-muted-foreground">
          <li className="flex items-center">
            <StickyNote size="16" className="mr-1" /> {retro.note_count}
          </li>

          <li
            className={`flex items-center ${retro.task_count == retro.task_completed_count ? "text-green-600 dark:text-green-500" : ""}`}
          >
            <CircleCheck size="16" className="mr-1" />
            <span>
              {retro.task_count > 0
                ? `${retro.task_completed_count} / ${retro.task_count}`
                : "0"}
            </span>
          </li>
        </ul>
      </Link>
    </li>
  );
}
