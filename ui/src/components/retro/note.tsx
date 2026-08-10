import { accentForName, initialsFor } from "@/lib/column-accent";
import { cardVariants, spring } from "@/lib/motion";
import { Note as NoteType } from "@/types";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
  useDraggable,
} from "@dnd-kit/core";
import { GripVertical, Image, ImageOff, Pencil, Trash2 } from "lucide-react";
import { m } from "motion/react";
import React, { useState } from "react";
import { twMerge } from "tailwind-merge";
import { Button } from "../ui/button";
import GIFDialog from "./gif-dialog";
import NoteDeleteDialog from "./note-delete-dialog";
import NoteDialog from "./note-dialog";

interface NoteProps {
  note: NoteType;
  showGrip?: boolean;
  blur?: boolean;
  /** Shows who wrote it. Off during brainstorm, when notes are private. */
  showAuthor?: boolean;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onGifSelected?: (url: string) => void;
  onGifRemoved?: () => void;
}

export const Note = ({
  note,
  showGrip,
  blur,
  showAuthor,
  listeners,
  attributes,
  onEdit,
  onDelete,
  onGifSelected,
  onGifRemoved,
  className,
  ...props
}: NoteProps & React.ComponentProps<typeof m.div>) => {
  const hasActions = !!(onGifSelected || onGifRemoved || onDelete || onEdit);

  return (
    <m.div
      // layoutId keeps the same card alive across stage changes, so notes
      // glide into their groups instead of blinking out and back.
      layoutId={note.id}
      layout="position"
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring}
      className={twMerge(
        "group relative rounded-lg bg-surface-raised p-2 ring-1 ring-border/70",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow duration-200",
        "hover:shadow-[0_4px_16px_-4px_rgb(0_0_0/0.12)]",
        className,
        blur ? "blur-xs select-none" : "",
      )}
      {...props}
    >
      {note.img_url && <NoteImage src={note.img_url} blur={blur} />}

      <div className="flex items-start gap-2">
        {showGrip && (
          <GripVertical
            {...listeners}
            {...attributes}
            className="mt-2 shrink-0 cursor-grab text-muted-foreground opacity-30 transition-opacity duration-150 focus:outline-hidden active:cursor-grabbing group-hover:opacity-100"
            size={16}
          />
        )}
        <p className="min-w-0 flex-1 py-1.5 break-words text-foreground">
          {note.content}
        </p>
      </div>

      {showAuthor && note.created_by_name && (
        <Author name={note.created_by_name} />
      )}

      {hasActions && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-px rounded-md bg-surface-raised/95 p-0.5 opacity-0 shadow-sm ring-1 ring-border backdrop-blur-sm transition-all duration-150 group-hover:opacity-100 focus-within:opacity-100">
          {onGifSelected && note.img_url === "" && (
            <GIFDialog onSelect={onGifSelected}>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Add an image"
              >
                <Image className="size-3.5" />
              </Button>
            </GIFDialog>
          )}

          {onGifRemoved && note.img_url !== "" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Remove the image"
              onClick={onGifRemoved}
            >
              <ImageOff className="size-3.5" />
            </Button>
          )}

          {onDelete && (
            <NoteDeleteDialog onDelete={onDelete}>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete this note"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </NoteDeleteDialog>
          )}

          {onEdit && (
            <NoteDialog
              title="Edit note"
              description="Change what this note says."
              content={note.content}
              onContentSave={onEdit}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Edit this note"
              >
                <Pencil className="size-3.5" />
              </Button>
            </NoteDialog>
          )}
        </div>
      )}
    </m.div>
  );
};

/**
 * Fixed aspect box with a placeholder: the image used to pop in at its natural
 * height and shove everything below it down the page.
 */
function NoteImage({ src, blur }: { src: string; blur?: boolean }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={twMerge(
        // Capped as well as ratio'd: on a wide column a 16:9 box alone would
        // let one GIF dominate the whole board.
        "relative mb-2 aspect-video max-h-52 overflow-hidden rounded-md bg-muted",
        blur ? "blur-md" : "",
      )}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}

      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={twMerge(
          "h-full w-full object-contain transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

function Author({ name }: { name: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 pl-0.5">
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full text-[9px] font-semibold text-background"
        style={{ background: accentForName(name) }}
      >
        {initialsFor(name)}
      </span>
      <span className="truncate text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export function DraggableNote({
  note,
  ...actions
}: {
  note: NoteType;
} & Pick<NoteProps, "onEdit" | "onDelete" | "onGifSelected" | "onGifRemoved" | "showAuthor">) {
  const { setNodeRef, transform, listeners, attributes, isDragging } =
    useDraggable({
      id: note.id,
    });

  return (
    <Note
      ref={setNodeRef}
      note={note}
      showGrip
      listeners={listeners}
      attributes={attributes}
      style={
        transform
          ? {
              // translate3d rather than motion's x/y so it does not fight the
              // layout animation while a drag is in flight.
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(1.5deg) scale(1.03)`,
              zIndex: 30,
            }
          : undefined
      }
      className={
        isDragging
          ? "cursor-grabbing shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)] ring-primary/40"
          : ""
      }
      {...actions}
    />
  );
}
