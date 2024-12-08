import { Calendar, Pencil, User } from "lucide-react";
import { Task as TaskType } from "@/types";
import { Button } from "../ui/button";
import TaskDialog, { TaskData } from "./task-dialog";

export function Task({
  task,
  onEdit,
}: {
  task: TaskType;
  onEdit: (task: TaskData) => void;
}) {
  return (
    <div className="group flex items-center justify-between p-2 space-x-2 rounded-md bg-card border animate-in fade-in slide-in-from-right duration-200">
      <div className="p-2 w-full">
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center space-x-2">
            <User className="size-4" />
            <span className="text-sm text-muted-foreground">{task.who}</span>
            <Calendar className="size-4" />
            <span className="text-sm text-muted-foreground">
              {new Date(task.when).toLocaleDateString()}
            </span>
          </div>

          <TaskDialog
            title="Edit Task"
            description="Edit this task."
            data={task}
            onSave={onEdit}
          >
            <Button
              variant="ghost"
              size="sm"
              className="opacity-30 group-hover:opacity-100 transition-opacity duration-100"
            >
              <Pencil />
            </Button>
          </TaskDialog>
        </div>

        <p className="mt-2 text-foreground text-wrap flex-grow">{task.what}</p>
      </div>
    </div>
  );
}
