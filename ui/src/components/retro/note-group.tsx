import { useDroppable } from "@dnd-kit/core";
import { Flame, Vote } from "lucide-react";
import React, { Children, forwardRef } from "react";
import { twMerge } from "tailwind-merge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface NoteGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  voteCount?: {
    forGroup: number;
    total: number;
  };
}

const noteFlameThreshold = 0.11;

export const NoteGroup = forwardRef<HTMLDivElement, NoteGroupProps>(
  ({ voteCount, className, children, ...props }, ref) => {
    const hasVoteCount = voteCount !== undefined;

    const classes = twMerge(
      "space-y-2 bg-accent rounded-lg transition-all duration-100",
      hasVoteCount || Children.count(children) > 1 ? "p-1" : "p-0",
      className,
    );

    return (
      <div ref={ref} className={classes} {...props}>
        {children}

        {hasVoteCount && (
          <VoteCount forGroup={voteCount.forGroup} total={voteCount.total} />
        )}
      </div>
    );
  },
);

function VoteCount({ forGroup, total }: { forGroup: number; total: number }) {
  let [Icon, variant] = [Vote, "outline"] as [
    React.ElementType,
    "destructive" | "outline",
  ];
  if (forGroup / total >= noteFlameThreshold) {
    [Icon, variant] = [Flame, "destructive"];
  }

  return (
    <div className="flex justify-end">
      <Badge variant={variant}>
        <Icon className="size-4 mr-2" /> {forGroup}
      </Badge>
    </div>
  );
}

export function DroppableNoteGroup({
  id,
  columnId,
  children,
}: {
  id: string;
  columnId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId + "." + id,
  });

  return (
    <NoteGroup className={isOver ? "p-2" : ""} ref={setNodeRef}>
      {children}
    </NoteGroup>
  );
}

export function VotableNoteGroup({
  children,
  voted,
  onVote,
}: {
  children: React.ReactNode;
  voted: boolean;
  onVote: (value: boolean) => void;
}) {
  return (
    <NoteGroup className="group transition-all duration-100">
      {children}

      <div className="flex justify-end">
        <Button
          variant={voted ? "default" : "secondary"}
          size="sm"
          onClick={() => onVote(!voted)}
        >
          <Vote />
        </Button>
      </div>
    </NoteGroup>
  );
}
