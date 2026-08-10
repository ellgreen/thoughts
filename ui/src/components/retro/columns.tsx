import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnActions } from "@/hooks/use-columns";
import * as types from "@/types";
import { useDroppable } from "@dnd-kit/core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Children } from "react";
import { twMerge } from "tailwind-merge";
import { Heading } from "../typography";
import ColumnDeleteDialog from "./column-delete-dialog";
import ColumnDialog, { ColumnData } from "./column-dialog";

const gridColumns = [
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
  "grid-cols-6",
];

function Columns({
  children,
  count,
  onAddColumn,
  canAddColumn,
}: {
  children: React.ReactNode;
  /** Overrides the child count. Discuss appends a synthetic Tasks column. */
  count?: number;
  onAddColumn?: (data: ColumnData) => void;
  canAddColumn?: boolean;
}) {
  // Clamped: outside 2..6 the lookup is undefined, which used to collapse the
  // whole board into a single column.
  const columnCount = Math.min(
    Math.max(count ?? Children.count(children), 2),
    6,
  );

  return (
    <div className="space-y-2">
      {onAddColumn && (
        <div className="flex justify-end">
          <ColumnDialog
            title="New column"
            description="Add a column to this retro."
            onSave={onAddColumn}
          >
            <Button
              variant="ghost"
              size="sm"
              disabled={!canAddColumn}
              className="text-muted-foreground"
            >
              <Plus className="size-3.5" />
              Add column
            </Button>
          </ColumnDialog>
        </div>
      )}

      <div className={`grid gap-4 ${gridColumns[columnCount - 2]}`}>
        {children}
      </div>
    </div>
  );
}

const Column = function Column({
  column,
  children,
  className,
  onEdit,
  onDelete,
  canDelete,
  ...props
}: {
  column: types.RetroColumn;
  children: React.ReactNode;
  className?: string;
} & Partial<ColumnActions> &
  React.ComponentProps<"div">) {
  const hasActions = !!(onEdit || onDelete);

  return (
    // A named group: notes use a bare `group` for their own hover actions, and
    // a bare group here would reveal these whenever a note is hovered.
    <div className={twMerge("group/column rounded-md", className)} {...props}>
      <div className="flex items-start gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <Heading variant="h2">{column.title}</Heading>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {column.description}
          </p>
        </div>

        {hasActions && (
          <div className="flex shrink-0 items-center gap-px opacity-0 transition-opacity duration-150 group-hover/column:opacity-100 focus-within:opacity-100">
            {onEdit && (
              <ColumnDialog
                title="Edit column"
                description="Rename this column or change its prompt."
                column={column}
                onSave={onEdit}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label={`Edit ${column.title}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </ColumnDialog>
            )}

            {onDelete && (
              <ColumnDeleteButton
                column={column}
                onDelete={onDelete}
                canDelete={!!canDelete}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-4">{children}</div>
    </div>
  );
};

function ColumnDeleteButton({
  column,
  onDelete,
  canDelete,
}: {
  column: types.RetroColumn;
} & Pick<ColumnActions, "onDelete" | "canDelete">) {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      disabled={!canDelete}
      className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label={`Delete ${column.title}`}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );

  if (canDelete) {
    return (
      <ColumnDeleteDialog columnTitle={column.title} onDelete={onDelete}>
        {button}
      </ColumnDeleteDialog>
    );
  }

  return (
    <Tooltip>
      {/* A disabled button swallows pointer events, so the tooltip needs a
          wrapper to hang off. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>
        Only empty columns can be deleted, and a retro needs at least two.
      </TooltipContent>
    </Tooltip>
  );
}

function DroppableColumn({
  column,
  children,
  ...actions
}: {
  column: types.RetroColumn;
  children: React.ReactNode;
} & Partial<ColumnActions>) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <Column
      ref={setNodeRef}
      column={column}
      className={
        isOver
          ? "ring-2 ring-primary ring-offset-4 ring-offset-background bg-primary/5"
          : ""
      }
      {...actions}
    >
      {children}
    </Column>
  );
}

export { Column, Columns, DroppableColumn };
