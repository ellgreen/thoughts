import { RetroStatus } from "@/types";
import { Group, MessagesSquare, PenLine, Vote } from "lucide-react";

/**
 * The stage names shown in the UI, in order.
 *
 * The wire values are fixed by the API; these labels are ours. "Brainstorm"
 * became "Reflect": it says what people are actually doing in that stage
 * (writing down their own thoughts, privately) rather than naming a meeting
 * format, and it does not clash with "Group" the way "Gather" would.
 */
export const stages = [
  {
    status: "brainstorm",
    label: "Reflect",
    icon: PenLine,
    /** Label for the button that moves the retro *into* this stage. */
    action: "Back to reflecting",
  },
  {
    status: "group",
    label: "Group",
    icon: Group,
    action: "Start grouping",
  },
  {
    status: "vote",
    label: "Vote",
    icon: Vote,
    action: "Open voting",
  },
  {
    status: "discuss",
    label: "Discuss",
    icon: MessagesSquare,
    action: "Start discussing",
  },
] as const satisfies readonly {
  status: RetroStatus;
  label: string;
  icon: unknown;
  action: string;
}[];

export type Stage = (typeof stages)[number];

export function stageIndex(status: RetroStatus): number {
  return stages.findIndex((stage) => stage.status === status);
}

export function stageLabel(status: RetroStatus): string {
  return stages[stageIndex(status)]?.label ?? status;
}

/** The stage after this one, or undefined at the end of the retro. */
export function nextStage(status: RetroStatus): Stage | undefined {
  return stages[stageIndex(status) + 1];
}

/** The stage before this one, or undefined at the start. */
export function previousStage(status: RetroStatus): Stage | undefined {
  const index = stageIndex(status);

  return index > 0 ? stages[index - 1] : undefined;
}
