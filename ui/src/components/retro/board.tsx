import {
  createSocketEvent,
  PayloadError,
  PayloadStatusUpdated,
  SocketEvent,
} from "@/events";
import useRetro from "@/hooks/use-retro";
import { useToast } from "@/hooks/use-toast";
import { RetroStatus } from "@/types";
import { useEffect, useState } from "react";
import Brainstorm from "./brainstorm";
import ChangeStatusButton from "./change-status-button";
import Discuss from "./discuss";
import Group from "./group";
import StatusIndicator from "./status-indicator";
import Vote from "./vote";

export default function Board() {
  const {
    retro,
    socket: { sendJsonMessage, lastJsonMessage },
  } = useRetro();
  const { toast } = useToast();
  const [status, setStatus] = useState<RetroStatus>(retro.status);

  useEffect(() => {
    if (!lastJsonMessage) return;

    const event = lastJsonMessage as SocketEvent;
    switch (event.name) {
      case "error": {
        const payload = event.payload as PayloadError;

        toast({
          variant: "destructive",
          title: "Something went wrong",
          description: payload.message,
        });

        return;
      }
      case "status_updated": {
        const payload = event.payload as PayloadStatusUpdated;
        setStatus(payload.status);
        return;
      }
    }
  }, [lastJsonMessage]);

  function handleStatusUpdate(status: RetroStatus) {
    sendJsonMessage(createSocketEvent("status_update", { status }));
  }

  return (
    <>
      <nav className="mb-4 flex items-center justify-between">
        <StatusIndicator status={status} />

        <div className="flex space-x-2">
          <ChangeStatusButton
            variant="prev"
            status={status}
            onStatusUpdate={handleStatusUpdate}
          />
          <ChangeStatusButton
            variant="next"
            status={status}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      </nav>

      <BoardForStatus status={status} />
    </>
  );
}

function BoardForStatus({ status }: { status: RetroStatus }) {
  switch (status) {
    case "brainstorm":
      return <Brainstorm />;
    case "group":
      return <Group />;
    case "vote":
      return <Vote />;
    case "discuss":
      return <Discuss />;
    default:
      return <div>Unknown status: {status}</div>;
  }
}
