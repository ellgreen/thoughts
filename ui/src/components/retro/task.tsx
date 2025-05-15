import {
  Calendar,
  Check,
  CheckCircle,
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
  const isOverdue = new Date(task.when) < today;

  return (
    <div className="group flex items-center justify-between p-2 space-x-2 rounded-md bg-card border">
      <div className="p-2 w-full">
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center space-x-2">
            {task.completed ? (
              <>
                <CheckCircle className="size-4 text-green-600 dark:text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-500">
                  Complete
                </span>
              </>
            ) : (
              <>
                <Calendar
                  className={`size-4 ${isOverdue && "text-red-600 dark:text-red-500"}`}
                />
                <span
                  className={`text-sm ${isOverdue ? "text-red-600 dark:text-red-500" : "text-muted-foreground"}`}
                >
                  {new Date(task.when).toLocaleDateString()}
                </span>
              </>
            )}
            <User className="size-4" />
            <span className="text-sm text-muted-foreground">{task.who}</span>
          </div>

          <TaskActions task={task} onEdit={onEdit} onComplete={onComplete} />
        </div>

        <p className="mt-2 text-foreground text-wrap grow">{task.what}</p>
      </div>
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
        <DropdownMenuContent align="end">
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
