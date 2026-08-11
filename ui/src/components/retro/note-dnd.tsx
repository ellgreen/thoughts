import { Note } from "@/types";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { NoteOverlay } from "./note";

// By area a group always beats the column it sits in, leaving no way to drop
// a note into open space. pointerWithin ranks the tightest rect around the
// cursor first; keyboard drags have no pointer and fall back to overlap.
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);

  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

export default function NoteDndContext({
  notes,
  showAuthor,
  onDragEnd,
  children,
}: {
  notes: Note[];
  showAuthor?: boolean;
  onDragEnd: (event: DragEndEvent) => void;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // Without a threshold every click on the grip starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const active = notes.find((note) => note.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    onDragEnd(event);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}

      {/* The default drop animation flies the card back to the slot it
          started in, which is the one place it is no longer going. */}
      <DragOverlay dropAnimation={null}>
        {active && <NoteOverlay note={active} showAuthor={showAuthor} />}
      </DragOverlay>
    </DndContext>
  );
}
