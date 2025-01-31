import { Note as NoteType } from "@/types";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
  useDraggable,
} from "@dnd-kit/core";
import { GripVertical, Image, ImageOff, Pencil } from "lucide-react";
import React from "react";
import { twMerge } from "tailwind-merge";
import { Button } from "../ui/button";
import NoteDialog from "./note-dialog";
import GIFDialog from "./gif-dialog";

interface NoteProps extends React.HTMLAttributes<HTMLDivElement> {
  note: NoteType;
  showGrip?: boolean;
  blur?: boolean;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  onEdit?: (content: string) => void;
  onGifSelected?: (url: string) => void;
  onGifRemoved?: () => void;
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
      onGifSelected,
      onGifRemoved,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={twMerge(
          "grid gap-2 group p-2 rounded-md bg-card border",
          className,
          blur ? "blur-sm" : "",
        )}
        ref={ref}
        {...props}
      >
        {note.img_url && (
          <div
            className={twMerge(
              "flex justify-around max-h-48 rounded overflow-hidden bg-accent",
              blur ? "blur-md" : "",
            )}
          >
            <img className="h-full rounded" src={note.img_url} />
          </div>
        )}

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

          {onGifSelected && note.img_url === "" && (
            <GIFDialog onSelect={onGifSelected}>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-30 group-hover:opacity-100 transition-opacity duration-100"
              >
                <Image />
              </Button>
            </GIFDialog>
          )}

          {onGifRemoved && note.img_url !== "" && (
            <Button
              variant="ghost"
              size="icon"
              className="opacity-30 group-hover:opacity-100 transition-opacity duration-100"
              onClick={onGifRemoved}
            >
              <ImageOff />
            </Button>
          )}

          {onEdit && (
            <NoteDialog
              title="Edit Note"
              description="Edit the content of the note."
              content={note.content}
              onContentSave={onEdit}
            >
              <Button
                variant="ghost"
                size="icon"
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
  onGifSelected,
  onGifRemoved,
}: {
  note: NoteType;
  onEdit?: (content: string) => void;
  onGifSelected?: (url: string) => void;
  onGifRemoved?: () => void;
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
      onGifSelected={onGifSelected}
      onGifRemoved={onGifRemoved}
    />
  );
}
