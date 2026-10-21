import { useRef, useState, type CSSProperties } from "react";
import { Button, Input, isTextDropItem, TextField, useDrop, type DropItem } from "react-aria-components";
import type { Column, Group } from "@/lib/retro";
import { NOTE_TYPE, noteById, useBoard } from "./context";
import { HiddenNote, inkFor, NoteCard, type Ink } from "./note";

async function droppedNoteId(items: DropItem[]) {
  const item = items.find((i) => isTextDropItem(i) && i.types.has(NOTE_TYPE));
  return item && isTextDropItem(item) ? item.getText(NOTE_TYPE) : null;
}

export function Columns() {
  const { board } = useBoard();
  const n = board.retro.columns.length;
  return (
    <div
      className="grid snap-x snap-mandatory auto-cols-[minmax(16rem,82vw)] grid-flow-col gap-6 overflow-x-auto pb-4 sm:auto-cols-[minmax(17rem,1fr)] lg:grid-flow-row lg:grid-cols-[repeat(var(--columns),minmax(0,1fr))] lg:overflow-visible"
      style={{ "--columns": n } as CSSProperties}
    >
      {board.retro.columns.map((c, i) => (
        <ColumnView key={c.id} column={c} index={i} groups={board.groups.filter((g) => g.columnId === c.id)} />
      ))}
    </div>
  );
}

function ColumnView({ column, index, groups }: { column: Column; index: number; groups: Group[] }) {
  const { board, editNote, run, dragging } = useBoard();
  const stage = board.retro.stage;
  const ink = inkFor(index);
  const ref = useRef<HTMLDivElement>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    isDisabled: stage !== "reflect" && stage !== "group",
    getDropOperation: (types) => (types.has(NOTE_TYPE) ? "move" : "cancel"),
    onDrop: async (e) => {
      const id = await droppedNoteId(e.items);
      const from = id ? noteById(board, id)?.group : null;
      if (id && !(from?.columnId === column.id && from.notes.length === 1)) run("note.move", { id, columnId: column.id });
    },
  });

  const mine = groups.flatMap((g) => g.notes.filter((n) => n.mine));
  const hidden = groups.flatMap((g) => g.notes.filter((n) => n.hidden));

  return (
    <section data-column-id={column.id} data-column-index={index} className="flex min-w-0 snap-start flex-col gap-4" aria-labelledby={`col-${column.id}`}>
      <header className="flex flex-col gap-1 border-b-[2.5px] border-ink pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={`col-${column.id}`} className="font-display text-2xl leading-tight xl:text-3xl">
            {column.title}
          </h2>
        </div>
        {column.description && <p className="text-ink-soft">{column.description}</p>}
      </header>

      <div ref={ref} {...dropProps} className={`flex min-h-24 flex-col gap-4 ${isDropTarget ? "outline-3 outline-offset-4 outline-pink outline-dashed" : ""}`}>
        {stage === "reflect" ? (
          <>
            {mine.map((n) => (
              <NoteCard key={n.id} note={n} ink={ink} draggable showAuthor={false} canReact={false} />
            ))}
            {hidden.length > 0 && (
              <div className="grid grid-cols-2 gap-3" aria-label={`${hidden.length} hidden ${hidden.length === 1 ? "thought" : "thoughts"} from others`}>
                {hidden.map((n) => (
                  <HiddenNote key={n.id} size={n.size} ink={ink} />
                ))}
              </div>
            )}
            {mine.length === 0 && hidden.length === 0 && <p className="text-ink-soft">Nothing yet.</p>}
          </>
        ) : groups.length === 0 ? (
          <p className="text-ink-soft">Nothing came up here.</p>
        ) : (
          groups.map((g) => <Pile key={g.id} group={g} ink={ink} />)
        )}
      </div>

      {dragging && stage === "group" ? (
        <LooseDrop columnId={column.id} />
      ) : (stage === "reflect" || stage === "group") && (
        <Button
          onPress={() => editNote(null, column.id)}
          className="flex min-h-12 items-center justify-center gap-2 border-[2.5px] border-dashed border-ink font-bold hover:bg-blue-tint"
        >
          Add a thought
        </Button>
      )}
    </section>
  );
}

export function Pile({ group, ink }: { group: Group; ink: Ink }) {
  const { board, run, dragging } = useBoard();
  const stage = board.retro.stage;
  const ref = useRef<HTMLDivElement>(null);
  // A pile never takes its own note back. useDrop stops every drag event it
  // sees, so while enabled it would swallow the drop the column needs to pull
  // the note out.
  const own = !!dragging && group.notes.some((n) => n.id === dragging);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    isDisabled: stage !== "group" || own,
    getDropOperation: (types) => (types.has(NOTE_TYPE) ? "move" : "cancel"),
    onDrop: async (e) => {
      const id = await droppedNoteId(e.items);
      if (id) run("note.move", { id, groupId: group.id });
    },
  });
  const many = group.notes.length > 1;

  return (
    <div
      ref={ref}
      {...dropProps}
      data-group-id={group.id}
      className={`isolate flex flex-col ${isDropTarget ? "outline-3 outline-offset-4 outline-pink" : ""}`}
    >
      {(many || group.title) && <GroupTitle group={group} />}
      <div className="flex flex-col">
        {group.notes.map((n, i) => (
          <div key={n.id} style={i > 0 ? { marginTop: -20, marginLeft: i % 2 ? 16 : 6, marginRight: i % 2 ? 0 : 10 } : { marginRight: many ? 16 : 0 }}>
            <NoteCard
              note={n}
              ink={i % 2 ? (ink === "pink" ? "blue" : "pink") : ink}
              draggable={stage === "group"}
              showAuthor
              canReact={stage === "discuss"}
              stacked={many}
              ungroupTo={many ? group.columnId : undefined}
            />
          </div>
        ))}
      </div>
      {stage === "vote" && <VoteControls group={group} />}
    </div>
  );
}

function VoteControls({ group }: { group: Group }) {
  const { board, run } = useBoard();
  const left = board.votes.max - board.votes.used;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        onPress={() => run("vote.cast", { groupId: group.id, delta: 1 })}
        isDisabled={left === 0}
        className="inline-flex min-h-11 items-center gap-2 border-[2.5px] border-ink px-3 font-bold hover:bg-pink-tint disabled:opacity-50"
      >
        Vote
      </Button>
      {group.myVotes > 0 && (
        <Button onPress={() => run("vote.cast", { groupId: group.id, delta: -1 })} className="min-h-11 px-2 font-semibold underline-offset-4 hover:underline">
          Take one back
        </Button>
      )}
      <Stamps count={group.myVotes} label={`${group.myVotes} of your votes`} />
    </div>
  );
}

export function Stamps({ count, label, size = 30 }: { count: number; label: string; size?: number }) {
  if (count === 0) return null;
  return (
    <span role="img" aria-label={label} className="isolate ml-auto flex flex-wrap">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="overprint rounded-stamp bg-pink" style={{ width: size, height: size, marginLeft: i ? -size / 2.5 : 0 }} />
      ))}
    </span>
  );
}

function GroupTitle({ group }: { group: Group }) {
  const { board, run } = useBoard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.title);
  const canName = board.retro.stage === "group";

  if (editing) {
    return (
      <form
        className="mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          run("group.name", { id: group.id, title: draft }).then((ok) => ok && setEditing(false));
        }}
      >
        <TextField aria-label="Group name" value={draft} onChange={setDraft} autoFocus onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
          <Input onBlur={() => setEditing(false)} className="w-full border-b-[2.5px] border-ink bg-transparent font-display text-xl outline-none" />
        </TextField>
      </form>
    );
  }
  if (!canName) {
    return group.title ? <h3 className="mb-2 font-display text-xl leading-tight">{group.title}</h3> : null;
  }
  return (
    <Button
      onPress={() => {
        setDraft(group.title);
        setEditing(true);
      }}
      className="mb-2 self-start text-left font-display text-xl leading-tight hover:underline"
    >
      {group.title || <span className="font-sans text-base font-semibold text-ink-soft">Name this group</span>}
    </Button>
  );
}

// LooseDrop stands in for "Add a thought" while a note is being dragged, so
// there's always a big target for taking a note out of its group.
function LooseDrop({ columnId }: { columnId: string }) {
  const { run, setDragging } = useBoard();
  const ref = useRef<HTMLDivElement>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (types) => (types.has(NOTE_TYPE) ? "move" : "cancel"),
    onDrop: async (e) => {
      setDragging(null);
      const id = await droppedNoteId(e.items);
      if (id) run("note.move", { id, columnId });
    },
  });
  return (
    <div
      ref={ref}
      {...dropProps}
      className={`flex min-h-24 items-center justify-center border-[2.5px] border-dashed border-ink px-4 text-center font-bold ${isDropTarget ? "bg-pink-tint" : ""}`}
    >
      Drop here for a pile of its own
    </div>
  );
}
