import { RetroStatus } from "@/types";
import { Group, MessagesSquare, PenLine, Vote } from "lucide-react";

export const stages = [
  {
    status: "brainstorm",
    label: "Reflect",
    icon: PenLine,
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

export function nextStage(status: RetroStatus): Stage | undefined {
  return stages[stageIndex(status) + 1];
}

export function previousStage(status: RetroStatus): Stage | undefined {
  const index = stageIndex(status);

  return index > 0 ? stages[index - 1] : undefined;
}
