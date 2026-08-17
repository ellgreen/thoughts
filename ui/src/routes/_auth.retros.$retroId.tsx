import Container from "@/components/container";
import Board from "@/components/retro/board";
import SocketProvider from "@/components/retro/socket";
import { RetroContext } from "@/hooks/use-retro";
import { useSocketEvent } from "@/hooks/use-retro-socket";
import { api } from "@/lib/api";
import { SocketEvent } from "@/events";
import { Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_auth/retros/$retroId")({
  loader: async ({ params }) => {
    return (await api.get<Retro>(`/api/retros/${params.retroId}`)).data;
  },
  component: RouteComponent,
});

export default function RouteComponent() {
  const loaded = Route.useLoaderData();

  return (
    <SocketProvider retroId={loaded.id}>
      <RetroProvider loaded={loaded}>
        <Container>
          <Board />
        </Container>
      </RetroProvider>
    </SocketProvider>
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
