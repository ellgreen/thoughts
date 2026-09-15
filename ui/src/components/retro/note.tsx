import { accentForName } from "@/lib/column-accent";
import { cardVariants, spring } from "@/lib/motion";
import { REACTION_EMOJI } from "@/lib/reactions";
import { Note as NoteType, Reaction } from "@/types";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
  useDraggable,
} from "@dnd-kit/core";
import {
  GripVertical,
  Image,
  ImageOff,
  Pencil,
  SmilePlus,
  Trash2,
  Ungroup,
} from "lucide-react";
import { m } from "motion/react";
import React, { useState } from "react";
import { twMerge } from "tailwind-merge";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import GIFDialog from "./gif-dialog";
import NoteDeleteDialog from "./note-delete-dialog";
import NoteDialog from "./note-dialog";

interface NoteProps {
  note: NoteType;
  showGrip?: boolean;
  blur?: boolean;
  showAuthor?: boolean;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onGifSelected?: (url: string) => void;
  onGifRemoved?: () => void;
  onUngroup?: () => void;
  onReact?: (emoji: string, value: boolean) => void;
}

const shellClassName =
  "group relative rounded-lg bg-surface-raised p-2 ring-1 ring-border/70";

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
  onUngroup,
  onReact,
  className,
  ref,
  ...props
}: NoteProps & React.ComponentProps<typeof m.div>) => {
  return (
    <m.div
      ref={ref}
      layoutId={note.id}
      layout="position"
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring}
      className={twMerge(
        shellClassName,
        "shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow duration-200",
        "hover:shadow-[0_4px_16px_-4px_rgb(0_0_0/0.12)]",
        className,
        blur ? "blur-xs select-none" : "",
      )}
      {...props}
    >
      <NoteBody
        note={note}
        showGrip={showGrip}
        blur={blur}
        showAuthor={showAuthor}
        listeners={listeners}
        attributes={attributes}
        onEdit={onEdit}
        onDelete={onDelete}
        onGifSelected={onGifSelected}
        onGifRemoved={onGifRemoved}
        onUngroup={onUngroup}
        onReact={onReact}
      />
    </m.div>
  );
};

export function NoteOverlay({
  note,
  showAuthor,
}: {
  note: NoteType;
  showAuthor?: boolean;
}) {
  return (
    <div
      className={twMerge(
        shellClassName,
        "cursor-grabbing shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)] ring-primary/40",
      )}
      style={{ transform: "rotate(1.5deg) scale(1.03)" }}
    >
      <NoteBody note={note} showAuthor={showAuthor} showGrip />
    </div>
  );
}

function NoteBody({
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
  onUngroup,
  onReact,
}: NoteProps) {
  const hasActions = !!(
    onGifSelected ||
    onGifRemoved ||
    onDelete ||
    onEdit ||
    onUngroup
  );

  return (
    <>
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
        <p
          data-testid="note-content"
          className="min-w-0 flex-1 py-1.5 break-words text-foreground"
        >
          {note.content}
        </p>
      </div>

      {showAuthor && note.created_by_name && (
        <Author name={note.created_by_name} />
      )}

      {onReact && <ReactionBar reactions={note.reactions} onReact={onReact} />}

      {hasActions && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-px rounded-md bg-surface-raised p-0.5 opacity-0 shadow-sm ring-1 ring-border transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          {onUngroup && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label="Take this note out of its group"
                  onClick={onUngroup}
                >
                  <Ungroup className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Take out of this group</TooltipContent>
            </Tooltip>
          )}

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
    </>
  );
}

function NoteImage({ src, blur }: { src: string; blur?: boolean }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={twMerge(
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

function ReactionBar({
  reactions,
  onReact,
}: {
  reactions: Reaction[];
  onReact: (emoji: string, value: boolean) => void;
}) {
  const reacted = new Set(
    reactions.filter((r) => r.reacted_by_me).map((r) => r.emoji),
  );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onReact(reaction.emoji, !reaction.reacted_by_me)}
          className={twMerge(
            "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs ring-1 transition-colors",
            reaction.reacted_by_me
              ? "bg-primary/10 text-primary ring-primary/40"
              : "bg-surface-raised text-muted-foreground ring-border/70 hover:ring-border",
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="tabular-nums">{reaction.count}</span>
        </button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Add a reaction"
          >
            <SmilePlus className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <div className="flex gap-0.5">
            {REACTION_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji, !reacted.has(emoji))}
                className={twMerge(
                  "rounded-md p-1.5 text-base hover:bg-muted",
                  reacted.has(emoji) ? "bg-primary/10" : "",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Author({ name }: { name: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 pl-0.5">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: accentForName(name) }}
      />
      <span className="truncate text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export function DraggableNote({
  note,
  ref,
  ...actions
}: {
  note: NoteType;
  ref?: React.Ref<HTMLDivElement>;
} & Pick<
  NoteProps,
  | "onEdit"
  | "onDelete"
  | "onGifSelected"
  | "onGifRemoved"
  | "onUngroup"
  | "showAuthor"
>) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: note.id,
  });

  return (
    <Note
      // Destructured out of the spread above, not left in it: popLayout
      // clones each child with a ref of its own, which used to land in the
      // spread and overwrite this one.
      ref={(node: HTMLDivElement | null) => {
        setNodeRef(node);

        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      note={note}
      showGrip
      listeners={listeners}
      attributes={attributes}
      // Animated rather than classed: motion writes opacity inline.
      animate={isDragging ? { opacity: 0.3, scale: 0.98 } : "animate"}
      {...actions}
    />
  );
}
