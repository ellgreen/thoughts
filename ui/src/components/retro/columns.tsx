import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnActions } from "@/hooks/use-columns";
import { accentStyle } from "@/lib/column-accent";
import * as types from "@/types";
import { useDroppable } from "@dnd-kit/core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Children } from "react";
import { twMerge } from "tailwind-merge";
import { Heading } from "../typography";
import ColumnDeleteDialog from "./column-delete-dialog";
import ColumnDialog, { ColumnData } from "./column-dialog";

// Literal strings so Tailwind's scanner finds them. Only applied from `lg`:
// below that the board is a horizontal snap-scroller, which beats crushing
// five columns into a phone.
const gridColumns = [
  "lg:grid-cols-2",
  "lg:grid-cols-3",
  "lg:grid-cols-4",
  "lg:grid-cols-5",
  "lg:grid-cols-6",
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

      <div
        className={twMerge(
          "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3",
          "lg:mx-0 lg:grid lg:snap-none lg:overflow-visible lg:px-0 lg:pb-0",
          gridColumns[columnCount - 2],
        )}
      >
        {children}
      </div>
    </div>
  );
}

const Column = function Column({
  column,
  index = 0,
  children,
  className,
  style,
  onEdit,
  onDelete,
  canDelete,
  ...props
}: {
  column: types.RetroColumn;
  /** Position in the board, which picks the accent colour. */
  index?: number;
  children: React.ReactNode;
  className?: string;
} & Partial<ColumnActions> &
  React.ComponentProps<"div">) {
  const hasActions = !!(onEdit || onDelete);

  return (
    // A named group: notes use a bare `group` for their own hover actions, and
    // a bare group here would reveal these whenever a note is hovered.
    <div
      style={{ ...accentStyle(index), ...style }}
      className={twMerge(
        "group/column w-[78vw] shrink-0 snap-start rounded-xl transition-colors sm:w-[340px]",
        "lg:w-auto lg:shrink",
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <Heading variant="h2" className="truncate text-2xl">
              {column.title}
            </Heading>
          </div>

          {column.description && (
            <p className="mt-0.5 pl-4 text-sm text-muted-foreground">
              {column.description}
            </p>
          )}
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

      {/* Accent rule, fading out so it frames rather than boxes in. */}
      <div
        aria-hidden
        className="mt-2 h-px w-full"
        style={{
          background:
            "linear-gradient(to right, var(--accent), color-mix(in oklch, var(--accent) 15%, transparent))",
        }}
      />

      <div className="mt-3 space-y-3">{children}</div>
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
  index,
  children,
  ...actions
}: {
  column: types.RetroColumn;
  index?: number;
  children: React.ReactNode;
} & Partial<ColumnActions>) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <Column
      ref={setNodeRef}
      column={column}
      index={index}
      className="transition-colors duration-200"
      style={{
        // outline rather than ring: it can be offset off the content without
        // taking up layout, so the board does not shift while dragging.
        outline: isOver
          ? "2px solid color-mix(in oklch, var(--accent) 65%, transparent)"
          : undefined,
        outlineOffset: "10px",
        backgroundColor: isOver
          ? "color-mix(in oklch, var(--accent) 7%, transparent)"
          : undefined,
      }}
      {...actions}
    >
      {children}
    </Column>
  );
}

export { Column, Columns, DroppableColumn };
