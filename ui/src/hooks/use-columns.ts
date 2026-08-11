import { createSocketEvent } from "@/events";
import { ColumnData } from "@/components/retro/column-dialog";
import { Note, RetroColumn } from "@/types";
import { useCallback, useMemo } from "react";
import useRetro from "./use-retro";

// Kept in step with minColumns/maxColumns in cmd/thoughts/event/columns.go.
const minColumns = 2;
const maxColumns = 5;

export interface ColumnActions {
  onEdit: (data: ColumnData) => void;
  onDelete: () => void;
  canDelete: boolean;
}

/**
 * Wires the column mutation events. Columns stay server-authoritative: they
 * only ever arrive via retro_updated, so there is no optimistic state here to
 * drift out of sync.
 *
 * Takes the notes rather than calling useNotes itself: a second copy would
 * mean a second fetch and a second reducer that diverges from the board's.
 */
export function useColumnActions(notes: Note[]) {
  const {
    retro,
    socket: { sendJsonMessage },
  } = useRetro();

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
      sendJsonMessage(createSocketEvent("column_create", data));
    },
    [sendJsonMessage],
  );

  const forColumn = useCallback(
    (column: RetroColumn): ColumnActions => ({
      onEdit: (data) =>
        sendJsonMessage(
          createSocketEvent("column_update", { id: column.id, ...data }),
        ),
      onDelete: () =>
        sendJsonMessage(createSocketEvent("column_delete", { id: column.id })),
      // Unconfirmed notes are in the list too, so a note being written right
      // now already blocks the delete.
      canDelete:
        (noteCounts[column.id] ?? 0) === 0 && columnCount > minColumns,
    }),
    [sendJsonMessage, noteCounts, columnCount],
  );

  return { create, forColumn, canCreate: columnCount < maxColumns };
}
