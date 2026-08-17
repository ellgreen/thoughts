import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  createSocketEvent,
  PayloadConnectionInfo,
  PayloadError,
  PayloadStatusUpdated,
  SocketEvent,
} from "@/events";
import useRetro from "@/hooks/use-retro";
import { useReadyState, useRetroSocket, useSocketEvent } from "@/hooks/use-retro-socket";
import { panelVariants } from "@/lib/motion";
import { RetroStatus } from "@/types";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import Brainstorm from "./brainstorm";
import ConnectionIndicator from "./connection-indicator";
import Discuss from "./discuss";
import Group from "./group";
import Settings from "./settings";
import ShowMarkdown from "./show-markdown";
import StageRail from "./stage-rail";
import Vote from "./vote";

export default function Board() {
  const { retro } = useRetro();
  const { send } = useRetroSocket();
  const readyState = useReadyState();
  const [status, setStatus] = useState<RetroStatus>(retro.status);
  const [connectionInfo, setConnectionInfo] = useState<PayloadConnectionInfo>({
    users: [],
  });
  const [votesRemaining, setVotesRemaining] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useSocketEvent((event: SocketEvent) => {
    switch (event.name) {
      case "error":
        toast("Something went wrong", {
          description: (event.payload as PayloadError).message,
        });
        return;
      case "status_updated":
        setStatus((event.payload as PayloadStatusUpdated).status);
        return;
      case "connection_info":
        setConnectionInfo(event.payload as PayloadConnectionInfo);
        return;
    }
  });

  function handleStatusUpdate(s: RetroStatus) {
    send(createSocketEvent("status_update", { status: s }));
  }

  return (
    <div className="flex flex-col pt-3">
      <div className="sticky top-12 z-40 mb-4">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          {/* Opaque, not backdrop-blurred: Nav is already a sticky
              backdrop-blur-xl directly above, and stacking a second one made
              both re-rasterise on every scroll frame. */}
          <div className="rounded-xl bg-background shadow-sm ring-1 ring-border/40">
            <div className="flex flex-col gap-1.5 px-4 py-2 sm:h-12 sm:flex-row sm:items-center sm:gap-3 sm:py-0">
              <span
                className={`min-w-0 flex-1 truncate font-bold tracking-tight ${
                  expanded ? "text-lg sm:text-2xl" : "text-base"
                }`}
              >
                {retro.title}
              </span>

              <div className="flex shrink-0 items-center gap-2">
                <StageRail status={status} onStatusUpdate={handleStatusUpdate} />

                <ConnectionIndicator
                  connectionInfo={connectionInfo}
                  readyState={readyState}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={expanded ? "Collapse details" : "Expand details"}
                  className="ml-auto size-7 shrink-0 text-muted-foreground"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? (
                    <ChevronUpIcon className="size-4" />
                  ) : (
                    <ChevronDownIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Expanded detail row */}
            <CollapsibleContent>
              <div className="flex items-center gap-4 border-t border-border/40 px-4 py-2.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {retro.tags && retro.tags.length > 0 ? (
                    retro.tags.map((tag) => (
                      <Link key={tag} to="/tags/$tag" params={{ tag }}>
                        <Badge
                          variant="outline"
                          className="h-5 cursor-pointer px-1.5 py-0 text-xs font-normal transition-colors hover:bg-accent"
                        >
                          #{tag}
                        </Badge>
                      </Link>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground/40 select-none">
                      no tags
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {status === "vote" && (
                      <m.span
                        key="votes-remaining"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        className="text-sm text-muted-foreground tabular-nums"
                      >
                        {votesRemaining} votes left
                      </m.span>
                    )}
                  </AnimatePresence>

                  {status === "discuss" && <ShowMarkdown />}
                  <Settings />
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* No AnimatePresence: mode="wait" meant the incoming stage waited out
          the outgoing one's exit, and the alternatives keep both mounted, so
          every note's layoutId would exist twice at once. */}
      <m.div key={status} variants={panelVariants} initial="initial" animate="animate">
        <BoardForStatus status={status} setVotesRemaining={setVotesRemaining} />
      </m.div>
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
