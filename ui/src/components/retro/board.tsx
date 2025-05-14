import {
  createSocketEvent,
  PayloadConnectionInfo,
  PayloadError,
  PayloadStatusUpdated,
  SocketEvent,
} from "@/events";
import useRetro from "@/hooks/use-retro";
import { RetroStatus } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Brainstorm from "./brainstorm";
import ChangeStatusButton from "./change-status-button";
import ConnectionIndicator from "./connection-indicator";
import Discuss from "./discuss";
import Group from "./group";
import Settings from "./settings";
import StatusIndicator from "./status-indicator";
import Vote from "./vote";

export default function Board() {
  const {
    retro,
    socket: { sendJsonMessage, lastJsonMessage, readyState },
  } = useRetro();
  const [status, setStatus] = useState<RetroStatus>(retro.status);
  const [connectionInfo, setConnectionInfo] = useState<PayloadConnectionInfo>({
    users: [],
  });

  const [votesRemaining, setVotesRemaining] = useState(0);

  useEffect(() => {
    if (!lastJsonMessage) return;

    const event = lastJsonMessage as SocketEvent;
    switch (event.name) {
      case "error": {
        const payload = event.payload as PayloadError;

        toast("Something went wrong", {
          description: payload.message,
        });

        return;
      }
      case "status_updated": {
        const payload = event.payload as PayloadStatusUpdated;
        setStatus(payload.status);
        return;
      }
      case "connection_info":
        setConnectionInfo(event.payload as PayloadConnectionInfo);
        return;
    }
  }, [lastJsonMessage]);

  function handleStatusUpdate(status: RetroStatus) {
    sendJsonMessage(createSocketEvent("status_update", { status }));
  }

  return (
    <>
      <nav className="mb-4 flex items-center justify-between">
        <StatusIndicator status={status} />

        <div className="flex items-center space-x-2">
          {status === "vote" && (
            <div className="mr-2 text-sm text-muted-foreground">
              {votesRemaining} votes remaining
            </div>
          )}

          <Settings />

          <ConnectionIndicator
            connectionInfo={connectionInfo}
            readyState={readyState}
          />

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

      <BoardForStatus status={status} setVotesRemaining={setVotesRemaining} />
    </>
  );
}

function BoardForStatus({
  status,
  setVotesRemaining,
}: {
  status: RetroStatus;
  setVotesRemaining: (votes: number) => void;
}) {
  switch (status) {
    case "brainstorm":
      return <Brainstorm />;
    case "group":
      return <Group />;
    case "vote":
      return <Vote setVotesRemaining={setVotesRemaining} />;
    case "discuss":
      return <Discuss />;
    default:
      return <div>Unknown status: {status}</div>;
  }
}
