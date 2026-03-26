import {
  Calendar,
  Check,
  Ellipsis,
  Pencil,
  User,
  X,
} from "lucide-react";
import { Task as TaskType } from "@/types";
import { Button } from "@/components/ui/button";
import TaskDialog, { TaskData } from "./task-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogTrigger } from "@/components/ui/dialog";
import { twMerge } from "tailwind-merge";

export function Task({
  task,
  onEdit,
  onComplete,
}: {
  task: TaskType;
  onEdit: (task: TaskData) => void;
  onComplete: (completed: boolean) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = !task.completed && new Date(task.when) < today;

  return (
    <div
      className={twMerge(
        "group rounded-md bg-card border p-3 transition-opacity",
        task.completed && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <Calendar
            className={twMerge(
              "size-3.5 shrink-0",
              isOverdue && "text-destructive/80",
            )}
          />
          <span className={isOverdue ? "text-destructive/80" : ""}>
            {new Date(task.when).toLocaleDateString()}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <User className="size-3.5 shrink-0" />
          <span className="truncate">{task.who}</span>
        </div>

        <TaskActions task={task} onEdit={onEdit} onComplete={onComplete} />
      </div>

      <p
        className={twMerge(
          "mt-1.5 text-sm text-foreground break-words",
          task.completed && "line-through",
        )}
      >
        {task.what}
      </p>
    </div>
  );
}

function TaskActions({
  task,
  onEdit,
  onComplete,
}: {
  task: TaskType;
  onEdit: (task: TaskData) => void;
  onComplete: (completed: boolean) => void;
}) {
  return (
    <TaskDialog
      title="Edit Task"
      description="Edit this task."
      data={task}
      onSave={onEdit}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-30 group-hover:opacity-100 transition-opacity duration-100"
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-max">
          {task.completed ? (
            <DropdownMenuItem onClick={() => onComplete(false)}>
              <X />
              <span>Mark as Incomplete</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onComplete(true)}>
              <Check />
              <span>Mark as Complete</span>
            </DropdownMenuItem>
          )}
          <DialogTrigger asChild>
            <DropdownMenuItem>
              <Pencil />
              <span>Edit</span>
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
    </TaskDialog>
  );
}
