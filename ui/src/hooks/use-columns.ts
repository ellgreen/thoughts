import { createSocketEvent } from "@/events";
import { ColumnData } from "@/components/retro/column-dialog";
import { Note, RetroColumn } from "@/types";
import { useCallback, useMemo } from "react";
import useRetro from "./use-retro";
import { useRetroSocket } from "./use-retro-socket";

// Kept in step with minColumns/maxColumns in cmd/thoughts/event/columns.go.
const minColumns = 2;
const maxColumns = 5;

export interface ColumnActions {
  onEdit: (data: ColumnData) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function useColumnActions(notes: Note[]) {
  const { retro } = useRetro();
  const { send } = useRetroSocket();

  const noteCounts = useMemo(
    () =>
      notes.reduce<Record<string, number>>((acc, note) => {
        acc[note.column_id] = (acc[note.column_id] ?? 0) + 1;
        return acc;
      }, {}),
    [notes],
  );

  const columnCount = retro.columns.length;

  const create = useCallback(
    (data: ColumnData) => {
      send(createSocketEvent("column_create", data));
    },
    [send],
  );

  const forColumn = useCallback(
    (column: RetroColumn): ColumnActions => ({
      onEdit: (data) =>
        send(createSocketEvent("column_update", { id: column.id, ...data })),
      onDelete: () =>
        send(createSocketEvent("column_delete", { id: column.id })),
      canDelete:
        (noteCounts[column.id] ?? 0) === 0 && columnCount > minColumns,
    }),
    [send, noteCounts, columnCount],
  );

  return { create, forColumn, canCreate: columnCount < maxColumns };
}
