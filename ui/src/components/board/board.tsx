import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { useShortcut } from "@/keys/keys";
import { stages, type Note, type Stage } from "@/lib/retro";
import { useRetroSocket } from "@/lib/socket";
import { Columns } from "./columns";
import { BoardContext, noteById, type BoardApi } from "./context";
import { Discuss } from "./discuss";
import { Bar } from "./bar";
import { Dock } from "./dock";
import { Settings, StageConfirm } from "./header";
import { MovePicker } from "./move";
import { NoteEditor } from "./note-editor";
import { AIPanel, RecapBlock } from "./suggestions";
import { LastTime } from "./facilitation";

export function RetroBoard({ retroId, me, gifSearch, ai }: { retroId: string; me: string; gifSearch: boolean; ai: boolean }) {
  const { board, people, status, send } = useRetroSocket(retroId);
  const toast = useToast();
  const [editing, setEditing] = useState<Note | null>(null);
  const [moving, setMoving] = useState<Note | null>(null);
  const [stageTo, setStageTo] = useState<Stage | null>(null);
  const [settings, setSettings] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

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
        editNote: setEditing,
        moveNote: setMoving,
        dragging,
        setDragging,
        dockSlot,
        picked: board.retro.stage === "group" && picked && noteById(board, picked) ? picked : null,
        setPicked,
      },
    [board, people, me, gifSearch, ai, send, run, dragging, dockSlot, picked],
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
      <div className="-mt-5 flex flex-col gap-5 pb-28">
        <Bar status={status} onSettings={() => setSettings(true)} onStage={setStageTo} />
        <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-5">
          <LastTime />
          {ai ? <AIPanel /> : null}
          {board.retro.stage === "discuss" && <RecapBlock />}
          {board.retro.stage === "discuss" ? <Discuss /> : <Columns />}
        </div>
      </div>
      <Dock onSlot={setDockSlot} />
      {editing && <NoteEditor note={editing} onClose={() => setEditing(null)} />}
      {moving && <MovePicker note={moving} onClose={() => setMoving(null)} />}
      {stageTo && <StageConfirm to={stageTo} onClose={() => setStageTo(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </BoardContext.Provider>
  );
}
