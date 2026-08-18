import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { spring } from "@/lib/motion";
import { nextStage, previousStage, stageIndex, stages } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { RetroStatus } from "@/types";
import { ArrowRight, Check, Undo2 } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";

export default function StageRail({
  status,
  onStatusUpdate,
}: {
  status: RetroStatus;
  onStatusUpdate: (status: RetroStatus) => void;
}) {
  const [pending, setPending] = useState<RetroStatus | null>(null);

  const current = stageIndex(status);
  const next = nextStage(status);
  const previous = previousStage(status);

  const pendingStage = stages.find((stage) => stage.status === pending);
  const goingBack = pendingStage ? stageIndex(pendingStage.status) < current : false;

  return (
    <>
      <div className="flex items-center gap-2">
        <ol className="flex items-center gap-0.5">
          {stages.map((stage, index) => {
            const done = index < current;
            const active = index === current;
            const Icon = done ? Check : stage.icon;

            return (
              <li
                key={stage.status}
                className={cn(
                  "items-center",
                  active ? "flex" : "hidden md:flex",
                )}
              >
                {index > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      "mx-0.5 hidden h-px w-3 transition-colors duration-300 md:block lg:w-5",
                      index <= current ? "bg-primary/60" : "bg-border",
                    )}
                  />
                )}

                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-2 py-1 text-sm",
                    "[&_svg]:size-3.5 [&_svg]:shrink-0",
                    active && "font-medium text-primary-foreground",
                    !active && done && "text-muted-foreground",
                    !active && !done && "text-muted-foreground/45",
                  )}
                >
                  {active && (
                    <m.span
                      layoutId="stage-rail-active"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-primary"
                    />
                  )}

                  <span className="relative flex items-center gap-1.5">
                    <Icon />
                    <span className={cn(!active && "hidden lg:inline")}>
                      {stage.label}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {previous && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Back to ${previous.label.toLowerCase()}`}
                onClick={() => setPending(previous.status)}
                className="size-8 shrink-0 text-muted-foreground"
              >
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to {previous.label.toLowerCase()}</TooltipContent>
          </Tooltip>
        )}

        {next && (
          <Button
            type="button"
            onClick={() => setPending(next.status)}
            className="shrink-0 gap-1.5"
          >
            <span className="hidden sm:inline">{next.action}</span>
            <span className="sm:hidden">Next</span>
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {goingBack ? "Go back to" : "Move on to"}{" "}
              {pendingStage?.label.toLowerCase()}?
            </DialogTitle>
            <DialogDescription>
              Everyone sees this change straight away, so make sure the room is
              ready.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                if (pending) onStatusUpdate(pending);
                setPending(null);
              }}
            >
              {goingBack ? "Go back" : "Move on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
