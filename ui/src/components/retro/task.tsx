import { Calendar, User } from "lucide-react";
import { Task as TaskType } from "@/types";

export function Task({ task }: { task: TaskType }) {
  return (
    <div className="group flex items-center justify-between p-2 space-x-2 rounded-md bg-card border">
      <div className="p-2">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <User className="size-4" />
          <span className="text-sm text-muted-foreground">{task.who}</span>
          <Calendar className="size-4" />
          <span className="text-sm text-muted-foreground">
            {new Date(task.when).toLocaleDateString()}
          </span>
        </div>

        <p className="mt-2 text-foreground text-wrap flex-grow">{task.what}</p>
      </div>

      {/* <Button
        variant="ghost"
        size="sm"
        className="opacity-30 group-hover:opacity-100 transition-opacity duration-100"
      >
        <Pencil />
      </Button> */}
    </div>
  );
}
