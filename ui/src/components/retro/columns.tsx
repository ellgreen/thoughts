import * as types from "@/types";
import { useDroppable } from "@dnd-kit/core";
import { Children } from "react";
import { twMerge } from "tailwind-merge";
import { Heading } from "../typography";

function Columns({ children }: { children: React.ReactNode }) {
  const gridCols = [
    "grid-cols-2",
    "grid-cols-3",
    "grid-cols-4",
    "grid-cols-5",
    "grid-cols-6",
  ][Children.count(children) - 2];

  return <div className={`grid gap-4 ${gridCols}`}>{children}</div>;
}

const Column = function Column({
  column,
  children,
  className,
  ...props
}: {
  column: types.RetroColumn;
  children: React.ReactNode;
  className?: string;
} & React.ComponentProps<"div">) {
  return (
    <div className={twMerge("rounded-md", className)} {...props}>
      <div>
        <Heading variant="h2">{column.title}</Heading>
        <p className="mt-1">{column.description}</p>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
};

function DroppableColumn({
  column,
  children,
}: {
  column: types.RetroColumn;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <Column
      ref={setNodeRef}
      column={column}
      className={isOver ? "outline outline-offset-2 outline-primary" : ""}
    >
      {children}
    </Column>
  );
}

export { Column, Columns, DroppableColumn };
