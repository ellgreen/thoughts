import { RetroStatus } from "@/types";
import { Brain, CheckCircle2, ChevronRight, Group, Speech, Vote } from "lucide-react";

const stages = [
  { status: "brainstorm" as RetroStatus, icon: Brain, label: "Brainstorm" },
  { status: "group" as RetroStatus, icon: Group, label: "Group" },
  { status: "vote" as RetroStatus, icon: Vote, label: "Vote" },
  { status: "discuss" as RetroStatus, icon: Speech, label: "Discuss" },
];

export default function StatusIndicator({ status }: { status: RetroStatus }) {
  const currentIndex = stages.findIndex((s) => s.status === status);

  return (
    <ol className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const Icon = isDone ? CheckCircle2 : stage.icon;

        return (
          <li key={stage.status} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                className={`size-3.5 mx-0.5 shrink-0 ${
                  index <= currentIndex
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground/30"
                }`}
              />
            )}
            <span
              className={[
                "flex items-center gap-1.5 text-sm rounded-md px-2 py-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0",
                isActive
                  ? "bg-muted text-foreground font-medium border border-border"
                  : isDone
                    ? "text-muted-foreground/70"
                    : "text-muted-foreground/40",
              ].join(" ")}
            >
              <Icon />
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
