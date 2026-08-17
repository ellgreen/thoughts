import Container from "@/components/container";
import Board from "@/components/retro/board";
import { NoteSkeletons } from "@/components/retro/column-states";
import { Column, Columns } from "@/components/retro/columns";
import NotesProvider from "@/components/retro/notes";
import SocketProvider from "@/components/retro/socket";
import { RetroContext } from "@/hooks/use-retro";
import { useSocketEvent } from "@/hooks/use-retro-socket";
import { api } from "@/lib/api";
import { SocketEvent } from "@/events";
import { Note, Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_auth/retros/$retroId")({
  // Both only need the id from the path, so neither has to wait for the other.
  loader: async ({ params }) => {
    const [retro, notes] = await Promise.all([
      api.get<Retro>(`/api/retros/${params.retroId}`),
      api.get<Note[]>(`/api/retros/${params.retroId}/notes`),
    ]);

    return { retro: retro.data, notes: notes.data };
  },
  pendingComponent: BoardPending,
  component: RouteComponent,
});

export default function RouteComponent() {
  const { retro, notes } = Route.useLoaderData();

  return (
    <SocketProvider retroId={retro.id}>
      <RetroProvider loaded={retro}>
        <NotesProvider notes={notes}>
          <Container>
            <Board />
          </Container>
        </NotesProvider>
      </RetroProvider>
    </SocketProvider>
  );
}

function BoardPending() {
  return (
    <Container>
      <div className="flex flex-col pt-3">
        <div className="mb-4 h-12 animate-pulse rounded-xl bg-surface" />

        <Columns>
          {[0, 1].map((i) => (
            <Column
              key={i}
              index={i}
              column={{ id: `${i}`, title: "", description: "" }}
            >
              <NoteSkeletons />
            </Column>
          ))}
        </Columns>
      </div>
    </Container>
  );
}

function RetroProvider({
  loaded,
  children,
}: {
  loaded: Retro;
  children: React.ReactNode;
}) {
  const [retro, setRetro] = useState<Retro>(loaded);

  // Owned here rather than in Settings: that component lives inside the
  // board's collapsible header, which Radix unmounts when collapsed, so
  // column and settings changes from other people would be missed.
  useSocketEvent((event: SocketEvent) => {
    if (event.name === "retro_updated") {
      setRetro(event.payload as Retro);
    }
  });

  const value = useMemo(() => ({ retro, setRetro }), [retro]);

  return (
    <RetroContext.Provider value={value}>{children}</RetroContext.Provider>
  );
}
