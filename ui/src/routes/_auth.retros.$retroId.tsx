import Board from "@/components/retro/board";
import { Heading } from "@/components/typography";
import { RetroContext } from "@/hooks/use-retro";
import { api } from "@/lib/api";
import { socketURL } from "@/lib/socket";
import { Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";
import useWebSocket from "react-use-websocket";

export const Route = createFileRoute("/_auth/retros/$retroId")({
  loader: async ({ params }) => {
    return (await api.get<Retro>(`/api/retros/${params.retroId}`)).data;
  },
  component: RouteComponent,
});

export default function RouteComponent() {
  const retro = Route.useLoaderData();

  const socket = useWebSocket(socketURL(`/api/retros/${retro.id}/ws`).href, {
    share: true,
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: (attemptNumber) =>
      Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
  });

  return (
    <RetroContext.Provider value={{ retro, socket }}>
      <Heading variant="h1" className="mb-8">
        {retro.title}
      </Heading>

      <Board />
    </RetroContext.Provider>
  );
}
