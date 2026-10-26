import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover, useDrag, type PopoverProps } from "react-aria-components";
import { reactions, type Note } from "@/lib/retro";
import { useToast } from "@/components/toast";
import { NOTE_TYPE, noteById, useBoard } from "./context";

export type Ink = "pink" | "blue";
export const inkFor = (columnIndex: number): Ink => (columnIndex % 2 === 0 ? "pink" : "blue");

const tint = { pink: "bg-pink-tint", blue: "bg-blue-tint" };
const halftone = { pink: "var(--color-pink)", blue: "var(--color-blue)" };

export function HiddenNote({ size = 1, ink }: { size?: number; ink: Ink }) {
  return (
    <div
      role="img"
      aria-label="Someone's thought, hidden until grouping"
      className="w-full opacity-60"
      style={{
        height: 28 + size * 22,
        backgroundImage: `radial-gradient(${halftone[ink]} 28%, transparent 31%)`,
        backgroundSize: "9px 9px",
      }}
    />
  );
}

type Props = {
  note: Note;
  ink: Ink;
  draggable: boolean;
  showAuthor: boolean;
  canReact: boolean;
  stacked?: boolean;
  // ungroupTo is the column to take the note out into, when it's in a group
  // with others.
  ungroupTo?: string;
};

export function NoteCard({ note, ink, draggable, showAuthor, canReact, stacked, ungroupTo }: Props) {
  const { board, editNote, moveNote, run, setDragging } = useBoard();
  const toast = useToast();
  const ref = useRef<HTMLElement>(null);
  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ [NOTE_TYPE]: note.id, "text/plain": note.content ?? "" }],
    getAllowedDropOperations: () => ["move"],
    isDisabled: !draggable,
    onDragStart: () => setDragging(note.id),
    onDragEnd: () => setDragging(null),
  });
  // Only the pointer half of useDrag: its keyboard drag starts on Enter,
  // which fights the board's shortcuts. Keyboard users move notes with M.
  const pointerDrag = draggable
    ? { draggable: dragProps.draggable, onDragStart: dragProps.onDragStart, onDrag: dragProps.onDrag, onDragEnd: dragProps.onDragEnd }
    : {};
  const stage = board.retro.stage;
  const editable = note.mine && (stage === "reflect" || stage === "group");

  async function remove() {
    const columnId = noteById(board, note.id)?.group.columnId;
    if (!(await run("note.delete", { id: note.id }))) return;
    const undo = note.content && !note.imgUrl && columnId ? { label: "Undo", run: () => run("note.add", { columnId, content: note.content }) } : undefined;
    toast("Note deleted", { action: undo });
  }

  return (
    <article
      ref={ref}
      data-note-id={note.id}
      aria-label={`${note.content ?? ""}${showAuthor && note.author ? `, by ${note.author.name}` : ""}`}
      {...pointerDrag}
      className={`group/note relative flex flex-col gap-2 p-4 text-[17px] leading-snug font-medium outline-offset-2 ${tint[ink]} ${stacked ? "overprint" : ""} ${isDragging ? "opacity-40" : ""} ${draggable ? "cursor-grab" : ""}`}
    >
      {note.content && <p data-testid="note-content" className="break-words whitespace-pre-wrap">{note.content}</p>}
      {note.imgUrl && <img src={note.imgUrl} alt="" className="max-h-56 w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />}
      {(showAuthor && note.author) || editable || canReact ? (
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
          {showAuthor && note.author && <span className="text-sm font-bold">{note.mine ? "You" : note.author.name}</span>}
          {canReact && <Reactions note={note} />}
          {(editable || (stage === "group" && draggable)) && (
            <QuickMenu
              placement="bottom end"
              className="min-w-48"
              trigger={
                <Button aria-label="Note options" className="ml-auto inline-flex size-9 items-center justify-center hover:bg-paper/60">
                  <svg viewBox="0 0 20 20" className="size-5 fill-current" aria-hidden="true">
                    <circle cx="4" cy="10" r="1.8" />
                    <circle cx="10" cy="10" r="1.8" />
                    <circle cx="16" cy="10" r="1.8" />
                  </svg>
                </Button>
              }
            >
                <Menu
                  className="flex flex-col outline-none"
                  onAction={(key) => {
                    if (key === "edit") editNote(note);
                    if (key === "move") moveNote(note);
                    if (key === "ungroup") run("note.move", { id: note.id, columnId: ungroupTo });
                    if (key === "unimage") run("note.edit", { id: note.id, imgUrl: "" });
                    if (key === "delete") remove();
                  }}
                >
                  {editable && <Item id="edit" label={note.imgUrl ? "Edit" : "Edit or add an image"} />}
                  <Item id="move" label="Move to…" />
                  {stage === "group" && ungroupTo && <Item id="ungroup" label="Take out of this group" />}
                  {editable && note.imgUrl && <Item id="unimage" label="Remove the image" />}
                  {editable && <Item id="delete" label="Delete" />}
                </Menu>
            </QuickMenu>
          )}
        </div>
      ) : null}
    </article>
  );
}

// QuickMenu is non-modal, so pressing another note's menu opens it at once
// instead of only closing this one. Non-modal popovers don't close on an
// outside press by themselves.
function QuickMenu({ trigger, children, className = "", ...popover }: { trigger: ReactNode; children: ReactNode; className?: string } & Omit<PopoverProps, "children" | "className" | "trigger">) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      // On its own trigger, keep focus in the menu: its blur would close it
      // and the trigger's press would open it straight back up.
      if (triggerRef.current?.contains(t)) return e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      <span ref={triggerRef} className="contents">
        {trigger}
      </span>
      <Popover ref={popoverRef} offset={4} isNonModal {...popover} className={`border-[2.5px] border-ink bg-paper ${className}`}>
        {children}
      </Popover>
    </MenuTrigger>
  );
}

function Item({ id, label }: { id: string; label: string }) {
  return (
    <MenuItem id={id} className="flex min-h-11 cursor-default items-center px-3 font-semibold outline-none data-focused:bg-blue-tint">
      {label}
    </MenuItem>
  );
}

function Reactions({ note }: { note: Note }) {
  const { run } = useBoard();
  const set = (emoji: string, on: boolean) => run("reaction.set", { noteId: note.id, emoji, on });
  return (
    <span className="flex flex-wrap items-center gap-1">
      {note.reactions.map((r) => (
        <Button
          key={r.emoji}
          onPress={() => set(r.emoji, !r.mine)}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ", including you" : ""}`}
          className={`inline-flex min-h-8 items-center gap-1 rounded-stamp px-2 text-sm font-bold ${r.mine ? "bg-ink text-paper" : "bg-paper/70"}`}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.count}
        </Button>
      ))}
      <QuickMenu
        trigger={
          <Button aria-label="Add a reaction" data-react-button className="inline-flex size-8 items-center justify-center rounded-stamp hover:bg-paper/60">
            <svg viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M7 12c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5M7.5 8h0M12.5 8h0" strokeLinecap="round" />
            </svg>
          </Button>
        }
      >
          <Menu aria-label="Reactions" className="flex outline-none" onAction={(k) => set(String(k), true)}>
            {reactions.map((e) => (
              <MenuItem key={e} id={e} textValue={e} className="flex size-11 cursor-default items-center justify-center text-xl outline-none data-focused:bg-blue-tint">
                {e}
              </MenuItem>
            ))}
          </Menu>
      </QuickMenu>
    </span>
  );
}
