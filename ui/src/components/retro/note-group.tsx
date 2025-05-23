import { useDroppable } from "@dnd-kit/core";
import { Check, Flame, Vote, X } from "lucide-react";
import React, { Children } from "react";
import { twMerge } from "tailwind-merge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface NoteGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  voteCount?: {
    forGroup: number;
    total: number;
  };
  authors?: string[];
}

const noteFlameThreshold = 0.098;

export const NoteGroup = ({
  voteCount,
  authors,
  className,
  children,
  ...props
}: NoteGroupProps & React.ComponentProps<"div">) => {
  const hasVoteCount = voteCount !== undefined;

  const classes = twMerge(
    "space-y-1 bg-accent rounded-lg transition-all duration-100",
    hasVoteCount || Children.count(children) > 1 ? "p-0.5" : "p-0",
    className,
  );

  return (
    <div className={classes} {...props}>
      {children}

      {(authors || hasVoteCount) && (
        <div className="flex items-center justify-between p-2">
          {authors && (
            <div className="text-sm text-muted-foreground">
              {authors.join(", ")}
            </div>
          )}

          {hasVoteCount && (
            <VoteCount forGroup={voteCount.forGroup} total={voteCount.total} />
          )}
        </div>
      )}
    </div>
  );
};

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
  canVote,
}: {
  children: React.ReactNode;
  voted: boolean;
  onVote: (value: boolean) => void;
  canVote: boolean;
}) {
  return (
    <div className="group relative transition-all duration-100">
      <NoteGroup>{children}</NoteGroup>
      <div
        data-voted={voted}
        className={`absolute hidden group-hover:flex data-[voted=true]:flex
        opacity-90 top-2 right-2 justify-end animate-in fade-in`}
      >
        <Button
          variant={voted ? "default" : "secondary"}
          size="sm"
          onClick={() => onVote(!voted)}
          disabled={!voted && !canVote}
        >
          {voted ? <X /> : <Check />}
          {voted ? "Unvote" : "Vote"}
        </Button>
      </div>
    </div>
  );
}
