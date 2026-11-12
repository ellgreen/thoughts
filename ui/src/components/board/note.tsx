import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Button, Menu, MenuItem, useDrag } from "react-aria-components";
import { motion, useIsPresent, useReducedMotionConfig, type Variants } from "motion/react";
import { enter, move, printed, printIn, quick } from "@/components/motion";
import { Item, QuickMenu } from "@/components/menu";
import { reactions, type Note } from "@/lib/retro";
import { useToast } from "@/components/toast";
import { field, useGrow } from "./composer";
import { useChanges } from "./changes";
import { CONTROLS, NOTE_TYPE, noteById, useBoard } from "./context";

export type Ink = "pink" | "blue";
export const inkFor = (columnIndex: number): Ink => (columnIndex % 2 === 0 ? "pink" : "blue");

const tint = { pink: "bg-pink-tint", blue: "bg-blue-tint" };
const halftone = { pink: "var(--color-pink)", blue: "var(--color-blue)" };
const dots = (ink: Ink) => `radial-gradient(${halftone[ink]} 28%, transparent 31%)`;

// A moved note's old copy stays until its new one has travelled into place;
// it must not be found, read or pressed meanwhile.
export function useLeaving() {
  const present = useIsPresent();
  return present ? {} : { inert: true, "aria-hidden": true };
}

// The variant runs once the element has left the board, with the newest
// board's answer passed through AnimatePresence's custom: deleted things
// fade, moved things go at once because they reappear somewhere else.
export const exitFor = (id: string): Variants => ({
  gone: (gone: (id: string) => boolean) => (gone(id) ? { opacity: 0, scale: 0.96, transition: quick } : { opacity: 0, transition: { duration: 0 } }),
});

export function useArrival(id: string) {
  const { fresh } = useChanges();
  const [arrived] = useState(() => fresh.has(id));
  return { initial: arrived ? printIn : false, animate: arrived ? printed : undefined } as const;
}

export function HiddenNote({ id, size = 1, ink }: { id: string; size?: number; ink: Ink }) {
  const arrival = useArrival(id);
  const leaving = useLeaving();
  return (
    <motion.div
      {...leaving}
      layout="position"
      layoutId={id}
      {...arrival}
      exit="gone"
      variants={exitFor(id)}
      transition={{ default: move, clipPath: enter }}
      role="img"
      aria-label="Someone's thought, hidden until grouping"
      className="w-full opacity-60"
      style={{
        height: 28 + size * 22,
        backgroundImage: dots(ink),
        backgroundSize: "9px 9px",
      }}
    />
  );
}

function Develop({ ink, delay }: { ink: Ink; delay: number }) {
  if (useReducedMotionConfig()) return null;
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ backgroundImage: dots(ink) }}
      initial={{ backgroundSize: "9px 9px", opacity: 0.6 }}
      animate={{ backgroundSize: "3px 3px", opacity: 0 }}
      transition={{ duration: 0.26, delay }}
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
  const { board, editNote, moveNote, run, setDragging, picked, setPicked } = useBoard();
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const ref = useRef<HTMLElement>(null);
  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ [NOTE_TYPE]: note.id, "text/plain": note.content ?? "" }],
    getAllowedDropOperations: () => ["move"],
    isDisabled: !draggable || editing,
    onDragStart: () => setDragging(note.id),
    onDragEnd: () => setDragging(null),
  });
  // Only the pointer half of useDrag: its keyboard drag starts on Enter,
  // which fights the board's shortcuts. Keyboard users move notes with M.
  const pointerDrag = draggable && !editing
    ? { draggable: dragProps.draggable, onDragStart: dragProps.onDragStart, onDrag: dragProps.onDrag, onDragEnd: dragProps.onDragEnd }
    : {};
  const stage = board.retro.stage;
  const editable = note.mine && (stage === "reflect" || stage === "group");

  const isPicked = picked === note.id;

  function pick(e: MouseEvent<HTMLElement>) {
    if (stage !== "group" || !draggable || editing || (e.target as Element).closest(CONTROLS)) return;
    if (!picked) return setPicked(note.id);
    const to = noteById(board, note.id)?.group;
    const from = noteById(board, picked)?.group;
    if (to && from && to.id !== from.id) run("note.move", { id: picked, groupId: to.id });
    setPicked(null);
  }

  async function remove() {
    const columnId = noteById(board, note.id)?.group.columnId;
    if (!(await run("note.delete", { id: note.id }))) return;
    const undo = note.content && !note.imgUrl && columnId ? { label: "Undo", run: () => run("note.add", { columnId, content: note.content }) } : undefined;
    toast("Note deleted", { action: undo });
  }

  const develop = useChanges().reveal?.get(note.id);
  const arrival = useArrival(note.id);
  const leaving = useLeaving();

  return (
    <motion.div
      {...leaving}
      layout="position"
      layoutId={note.id}
      initial={arrival.initial}
      animate={{ ...arrival.animate, rotate: isPicked ? 2 : 0, y: isPicked ? -4 : 0 }}
      exit="gone"
      variants={exitFor(note.id)}
      transition={{ default: move, clipPath: enter }}
      className={isPicked ? "relative z-10" : undefined}
    >
    {/* The press is on the card rather than a button inside it: Firefox won't
    start a drag from a button. "Move to…" in the menu is the keyboard way. */}
    {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
    <article
      ref={ref}
      data-note-id={leaving.inert ? undefined : note.id}
      aria-label={`${note.content ?? ""}${showAuthor && note.author ? `, by ${note.author.name}` : ""}`}
      {...pointerDrag}
      onClick={pick}
      className={`group/note relative flex flex-col gap-2 p-4 text-[17px] leading-snug font-medium outline-offset-2 ${tint[ink]} ${stacked ? "overprint" : ""} ${isDragging ? "opacity-40" : ""} ${draggable ? "cursor-grab transition-shadow duration-150" : ""} ${isPicked ? "shadow-[4px_4px_0_var(--color-pink)]" : ""}`}
    >
      {editing ? (
        <EditField note={note} onDone={() => setEditing(false)} />
      ) : (
        note.content && <p data-testid="note-content" className="break-words whitespace-pre-wrap">{note.content}</p>
      )}
      {note.imgUrl && <img src={note.imgUrl} alt="" className="max-h-56 w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />}
      {(showAuthor && note.author) || editable || canReact ? (
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
          {showAuthor && note.author && <span className={`text-[13px] ${note.mine ? "font-bold" : "font-semibold"}`}>{note.mine ? "You" : note.author.name}</span>}
          {canReact && <Reactions note={note} />}
          {(editable || (stage === "group" && draggable)) && (
            <QuickMenu
              placement="bottom end"
              className="min-w-48"
              trigger={
                <Button aria-label="Note options" className="ml-auto inline-flex size-9 items-center justify-center opacity-40 hover:bg-paper/60 focus-visible:opacity-100! aria-expanded:opacity-100! pointer-fine:opacity-0 group-focus-within/note:opacity-100! group-hover/note:opacity-100!">
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
                    if (key === "edit") setEditing(true);
                    if (key === "image") editNote(note);
                    if (key === "move") moveNote(note);
                    if (key === "ungroup") run("note.move", { id: note.id, columnId: ungroupTo });
                    if (key === "unimage") run("note.edit", { id: note.id, imgUrl: "" });
                    if (key === "delete") remove();
                  }}
                >
                  {editable && <Item id="edit" label="Edit" />}
                  {editable && <Item id="image" label={note.imgUrl ? "Change the image" : "Add an image"} />}
                  <Item id="move" label="Move to…" />
                  {stage === "group" && ungroupTo && <Item id="ungroup" label="Take out of this group" />}
                  {editable && note.imgUrl && <Item id="unimage" label="Remove the image" />}
                  {editable && <Item id="delete" label="Delete" />}
                </Menu>
            </QuickMenu>
          )}
        </div>
      ) : null}
      {develop !== undefined && <Develop ink={ink} delay={develop} />}
    </article>
    </motion.div>
  );
}

function EditField({ note, onDone }: { note: Note; onDone: () => void }) {
  const { run } = useBoard();
  const [text, setText] = useState(note.content ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  useGrow(ref);
  const cancelled = useRef(false);

  async function save() {
    if (cancelled.current) return;
    const content = text.trim();
    if (!content || content === note.content) return onDone();
    if (await run("note.edit", { id: note.id, content })) onDone();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancelled.current = true;
      onDone();
    }
  }

  return (
    <textarea
      ref={ref}
      autoFocus
      rows={1}
      maxLength={500}
      value={text}
      aria-label="Edit your thought"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={save}
      onFocus={(e) => e.currentTarget.setSelectionRange(text.length, text.length)}
      className={`${field} bg-paper/60 pr-2`}
    />
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
