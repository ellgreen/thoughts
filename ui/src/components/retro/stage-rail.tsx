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
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { RetroStatus } from "@/types";
import { Brain, Check, Group, Speech, Vote } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";

const stages = [
  { status: "brainstorm", icon: Brain, label: "Brainstorm" },
  { status: "group", icon: Group, label: "Group" },
  { status: "vote", icon: Vote, label: "Vote" },
  { status: "discuss", icon: Speech, label: "Discuss" },
] as const satisfies readonly { status: RetroStatus; icon: unknown; label: string }[];

/**
 * Replaces a pair of anonymous chevrons with something that shows where the
 * retro actually is. Adjacent stages are clickable; the rest are context.
 */
export default function StageRail({
  status,
  onStatusUpdate,
}: {
  status: RetroStatus;
  onStatusUpdate: (status: RetroStatus) => void;
}) {
  const [pending, setPending] = useState<RetroStatus | null>(null);

  const currentIndex = stages.findIndex((stage) => stage.status === status);
  const pendingStage = stages.find((stage) => stage.status === pending);
  const movingForward = pendingStage
    ? stages.indexOf(pendingStage) > currentIndex
    : true;

  return (
    <>
      <ol className="flex items-center gap-0.5">
        {stages.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const reachable = Math.abs(index - currentIndex) === 1;
          const Icon = done ? Check : stage.icon;

          return (
            <li key={stage.status} className="flex items-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-0.5 h-px w-3 transition-colors duration-300 sm:w-5",
                    index <= currentIndex ? "bg-primary/60" : "bg-border",
                  )}
                />
              )}

              <button
                type="button"
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                onClick={() => setPending(stage.status)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors duration-200",
                  "[&_svg]:size-3.5 [&_svg]:shrink-0",
                  active && "font-medium text-primary-foreground",
                  !active && done && "text-muted-foreground hover:text-foreground",
                  !active && !done && "text-muted-foreground/45",
                  reachable && "hover:bg-accent/60 cursor-pointer",
                  !reachable && "cursor-default",
                )}
              >
                {active && (
                  // One shared element sliding between stages, rather than four
                  // backgrounds fading in and out.
                  <m.span
                    layoutId="stage-rail-active"
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-primary"
                  />
                )}

                <span className="relative flex items-center gap-1.5">
                  <Icon />
                  {/* Labels are the first thing to go when space is tight;
                      the icons and the filled pill still carry the state. */}
                  <span className={cn("hidden", active ? "sm:inline" : "lg:inline")}>
                    {stage.label}
                  </span>
                  <span className="sr-only">{stage.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movingForward ? "Move on to" : "Go back to"}{" "}
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
              {movingForward ? "Move on" : "Go back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
