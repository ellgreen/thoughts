import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { useShortcut } from "@/keys/keys";
import { stages, type Note, type Stage } from "@/lib/retro";
import { useRetroSocket } from "@/lib/socket";
import { Columns } from "./columns";
import { BoardContext, type BoardApi } from "./context";
import { Discuss } from "./discuss";
import { BoardHeader, Settings, StageConfirm } from "./header";
import { MovePicker } from "./move";
import { NoteEditor } from "./note-editor";
import { AIPanel, RecapBlock } from "./suggestions";
import { LastTime, ReadyCheck, Timer } from "./facilitation";

export function RetroBoard({ retroId, me, gifSearch, ai }: { retroId: string; me: string; gifSearch: boolean; ai: boolean }) {
  const { board, people, status, send } = useRetroSocket(retroId);
  const toast = useToast();
  const [editing, setEditing] = useState<{ note: Note | null; columnId?: string } | null>(null);
  const [moving, setMoving] = useState<Note | null>(null);
  const [stageTo, setStageTo] = useState<Stage | null>(null);
  const [settings, setSettings] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const run = useCallback(
    async (name: string, args?: unknown) => {
      try {
        await send(name, args);
        return true;
      } catch (e) {
        toast((e as Error).message, { tone: "problem" });
        return false;
      }
    },
    [send, toast],
  );

  const api = useMemo<BoardApi | null>(
    () =>
      board && {
        board,
        people,
        me,
        gifSearch,
        ai,
        send,
        run,
        editNote: (note, columnId) => setEditing({ note, columnId }),
        moveNote: setMoving,
        dragging,
        setDragging,
      },
    [board, people, me, gifSearch, ai, send, run, dragging],
  );

  const stage = board?.retro.stage;
  const at = stages.findIndex((s) => s.id === stage);

  useShortcut({ id: "next-stage", keys: "]", label: "Next stage", section: "Retro", run: () => at < 3 && setStageTo(stages[at + 1].id) }, !!board && at < 3);
  useShortcut({ id: "prev-stage", keys: "[", label: "Previous stage", section: "Retro", run: () => at > 0 && setStageTo(stages[at - 1].id) }, !!board && at > 0);
  if (!api || !board) {
    return <p className="text-lg" role="status">{status === "reconnecting" ? "Can't reach the retro. Trying again…" : "Opening the retro…"}</p>;
  }

  return (
    <BoardContext.Provider value={api}>
      <div className="flex flex-col gap-8">
        <BoardHeader status={status} onSettings={() => setSettings(true)} onStage={setStageTo} />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y-[2.5px] border-ink py-2">
          <ReadyCheck />
          <Timer />
        </div>
        <LastTime />
        {ai ? <AIPanel /> : null}
        {board.retro.stage === "discuss" && <RecapBlock />}
        {board.retro.stage === "discuss" ? <Discuss /> : <Columns />}
      </div>
      {editing && <NoteEditor note={editing.note} columnId={editing.columnId} onClose={() => setEditing(null)} />}
      {moving && <MovePicker note={moving} onClose={() => setMoving(null)} />}
      {stageTo && <StageConfirm to={stageTo} onClose={() => setStageTo(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </BoardContext.Provider>
  );
}
