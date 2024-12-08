import {
  createSocketEvent,
  PayloadConnectionInfo,
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
import { User, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export default function Board() {
  const {
    retro,
    socket: { sendJsonMessage, lastJsonMessage, readyState },
  } = useRetro();
  const { toast } = useToast();
  const [status, setStatus] = useState<RetroStatus>(retro.status);
  const [connectionInfo, setConnectionInfo] = useState<PayloadConnectionInfo>({
    users: [],
  });

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

        <div className="flex space-x-2">
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

      <BoardForStatus status={status} />
    </>
  );
}

function ConnectionIndicator({
  connectionInfo,
  readyState,
}: {
  connectionInfo: PayloadConnectionInfo;
  readyState: number;
}) {
  const [state, stateClassName] = {
    0: ["Connecting", "text-yellow-500"],
    1: ["Connected", "text-green-500"],
    2: ["Disconnecting", "text-yellow-500"],
    3: ["Disconnected", "text-red-500"],
  }[readyState] || ["Unknown", "text-red-500"];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <span>{state}</span>
          <Zap className={stateClassName} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {connectionInfo.users.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No users connected
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {connectionInfo.users.map((user) => (
              <li key={user} className="flex items-center space-x-2">
                <User className="size-4 text-muted-foreground" />
                <span>{user}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
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
