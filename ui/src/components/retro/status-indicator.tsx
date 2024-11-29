import { RetroStatus } from "@/types";
import { Brain, ChevronRight, Group, Speech, Vote } from "lucide-react";

export default function StatusIndicator({ status }: { status: RetroStatus }) {
  return (
    <ul className="flex items-center gap-2">
      <StatusItem active={status === "brainstorm"}>
        <Brain /> Brainstorm
      </StatusItem>
      <StatusItemSeparator />
      <StatusItem active={status === "group"}>
        <Group /> Group
      </StatusItem>
      <StatusItemSeparator />
      <StatusItem active={status === "vote"}>
        <Vote /> Vote
      </StatusItem>
      <StatusItemSeparator />
      <StatusItem active={status === "discuss"}>
        <Speech /> Discuss
      </StatusItem>
    </ul>
  );
}

function StatusItem({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  const activeClass = active
    ? "text-primary font-semibold"
    : "text-muted-foreground";

  return (
    <li
      className={
        "flex items-center gap-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0 " +
        activeClass
      }
    >
      {children}
    </li>
  );
}

function StatusItemSeparator() {
  return (
    <li>
      <ChevronRight className="size-4 text-muted-foreground" />
    </li>
  );
}
