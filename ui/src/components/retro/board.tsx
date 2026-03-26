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
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Brainstorm from "./brainstorm";
import ChangeStatusButton from "./change-status-button";
import ConnectionIndicator from "./connection-indicator";
import Discuss from "./discuss";
import Group from "./group";
import Settings from "./settings";
import StatusIndicator from "./status-indicator";
import Vote from "./vote";
import ShowMarkdown from "./show-markdown";

const stageLabel: Record<RetroStatus, string> = {
  brainstorm: "Brainstorm",
  group: "Group",
  vote: "Vote",
  discuss: "Discuss",
};

export default function Board() {
  const {
    retro,
    socket: { sendJsonMessage, lastJsonMessage, readyState },
  } = useRetro();
  const [status, setStatus] = useState<RetroStatus>(retro.status);
  const [connectionInfo, setConnectionInfo] = useState<PayloadConnectionInfo>({ users: [] });
  const [votesRemaining, setVotesRemaining] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!lastJsonMessage) return;
    const event = lastJsonMessage as SocketEvent;
    switch (event.name) {
      case "error":
        toast("Something went wrong", { description: (event.payload as PayloadError).message });
        return;
      case "status_updated":
        setStatus((event.payload as PayloadStatusUpdated).status);
        return;
      case "connection_info":
        setConnectionInfo(event.payload as PayloadConnectionInfo);
        return;
    }
  }, [lastJsonMessage]);

  function handleStatusUpdate(s: RetroStatus) {
    sendJsonMessage(createSocketEvent("status_update", { status: s }));
  }

  return (
    <div className="flex flex-col pt-3">
      {/* Sticky board header */}
      <div className="sticky top-12 z-40 mb-4">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="bg-background/80 backdrop-blur-xl rounded-xl ring-1 ring-border/40 shadow-sm">
            {/* Compact bar — always visible */}
            <div className="flex items-center gap-2 px-4 h-12">
              <span className={`font-bold tracking-tight truncate flex-1 min-w-0 transition-all ${expanded ? "text-2xl" : "text-base"}`}>
                {retro.title}
              </span>
              {!expanded && (
                <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex">
                  {stageLabel[status]}
                </Badge>
              )}
              <ChangeStatusButton variant="prev" status={status} onStatusUpdate={handleStatusUpdate} />
              <ChangeStatusButton variant="next" status={status} onStatusUpdate={handleStatusUpdate} />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
              </Button>
            </div>

            {/* Expanded detail row */}
            <CollapsibleContent>
              <div className="border-t border-border/40 px-4 py-2.5 flex items-center gap-4">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                  {retro.tags && retro.tags.length > 0 ? (
                    retro.tags.map((tag) => (
                      <Link key={tag} to="/tags/$tag" params={{ tag }}>
                        <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 h-5 hover:bg-accent transition-colors cursor-pointer">
                          #{tag}
                        </Badge>
                      </Link>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground/40 select-none">no tags</span>
                  )}
                </div>
                <div className="shrink-0">
                  <StatusIndicator status={status} />
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  {status === "vote" && (
                    <span className="text-sm text-muted-foreground">{votesRemaining} votes left</span>
                  )}
                  {status === "discuss" && <ShowMarkdown />}
                  <Settings />
                  <ConnectionIndicator connectionInfo={connectionInfo} readyState={readyState} />
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      <BoardForStatus status={status} setVotesRemaining={setVotesRemaining} />
    </div>
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
