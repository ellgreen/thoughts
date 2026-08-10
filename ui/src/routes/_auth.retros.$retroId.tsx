import Container from "@/components/container";
import Board from "@/components/retro/board";
import { RetroContext } from "@/hooks/use-retro";
import { api } from "@/lib/api";
import { socketURL } from "@/lib/socket";
import { SocketEvent } from "@/events";
import { Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";

export const Route = createFileRoute("/_auth/retros/$retroId")({
  loader: async ({ params }) => {
    return (await api.get<Retro>(`/api/retros/${params.retroId}`)).data;
  },
  component: RouteComponent,
});

export default function RouteComponent() {
  const [retro, setRetro] = useState<Retro>(Route.useLoaderData());

  const socket = useWebSocket(socketURL(`/api/retros/${retro.id}/ws`).href, {
    share: true,
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: (attemptNumber) =>
      Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
  });

  // Owned here rather than in Settings: that component lives inside the
  // board's collapsible header, which Radix unmounts when collapsed, so
  // column and settings changes from other people would be missed.
  const { lastJsonMessage } = socket;

  useEffect(() => {
    if (!lastJsonMessage) return;

    const event = lastJsonMessage as SocketEvent;

    if (event.name === "retro_updated") {
      setRetro(event.payload as Retro);
    }
  }, [lastJsonMessage]);

  return (
    <RetroContext.Provider value={{ retro, setRetro, socket }}>
      <Container>
        <Board />
      </Container>
    </RetroContext.Provider>
  );
}
