import { Note as NoteType } from "@/types";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
  useDraggable,
} from "@dnd-kit/core";
import { GripVertical, Pencil } from "lucide-react";
import React from "react";
import { twMerge } from "tailwind-merge";
import { Button } from "../ui/button";
import NoteDialog from "./note-dialog";

interface NoteProps extends React.HTMLAttributes<HTMLDivElement> {
  note: NoteType;
  showGrip?: boolean;
  blur?: boolean;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  onEdit?: (content: string) => void;
}

export const Note = React.forwardRef<HTMLDivElement, NoteProps>(
  (
    {
      note,
      showGrip,
      blur,
      listeners,
      attributes,
      onEdit,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={twMerge(
          "group p-2 rounded-md bg-card border",
          className,
          blur ? "blur-sm" : "",
        )}
        ref={ref}
        {...props}
      >
        <div className="flex items-center justify-between space-x-2">
          {showGrip && (
            <GripVertical
              {...listeners}
              {...attributes}
              className="flex-shrink-0 text-accent-foreground
              opacity-30 group-hover:opacity-100
              focus:outline-none cursor-move transition-opacity duration-100"
              size={16}
            />
          )}

          <p className="py-2 text-foreground text-wrap flex-grow">
            {note.content}
          </p>

          {onEdit && (
            <NoteDialog
              title="Edit Note"
              description="Edit the content of the note."
              content={note.content}
              onContentSave={onEdit}
            >
              <Button
                variant="ghost"
                size="sm"
                className="opacity-30 group-hover:opacity-100 transition-opacity duration-100"
              >
                <Pencil />
              </Button>
            </NoteDialog>
          )}
        </div>
      </div>
    );
  },
);

export function DraggableNote({
  note,
  onEdit,
}: {
  note: NoteType;
  onEdit?: (content: string) => void;
}) {
  const { setNodeRef, transform, listeners, attributes } = useDraggable({
    id: note.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <Note
      ref={setNodeRef}
      note={note}
      style={style}
      showGrip
      listeners={listeners}
      attributes={attributes}
      onEdit={onEdit}
    />
  );
}
