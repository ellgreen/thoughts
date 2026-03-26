import { useDroppable } from "@dnd-kit/core";
import { Check, Flame, TrendingUp, X } from "lucide-react";
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


export const NoteGroup = ({
  voteCount,
  authors,
  className,
  children,
  ...props
}: NoteGroupProps & React.ComponentProps<"div">) => {
  const hasVoteCount = voteCount !== undefined;
  const childCount = Children.count(children);
  const isGrouped = childCount > 1;
  const hasNonZeroVotes = hasVoteCount && voteCount.forGroup > 0;
  const showFooter = authors || hasNonZeroVotes;

  const classes = twMerge(
    "rounded-lg transition-all duration-100",
    isGrouped || hasVoteCount
      ? "bg-muted/60 border border-border/60 p-2 space-y-2"
      : "space-y-1",
    className,
  );

  return (
    <div className={classes} {...props}>
      {children}

      {showFooter && (
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          {authors && (
            <span className="text-xs text-muted-foreground truncate">
              {authors.join(", ")}
            </span>
          )}

          {hasNonZeroVotes && (
            <VoteCount forGroup={voteCount.forGroup} total={voteCount.total} />
          )}
        </div>
      )}
    </div>
  );
};

const hotThreshold = 0.098;

function VoteCount({ forGroup, total }: { forGroup: number; total: number }) {
  if (forGroup === 0 || total === 0) return null;

  let Icon: React.ElementType;
  let variant: "destructive" | "secondary";

  if (forGroup / total >= hotThreshold) {
    Icon = Flame;
    variant = "destructive";
  } else {
    Icon = TrendingUp;
    variant = "secondary";
  }

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3.5" /> {forGroup}
    </Badge>
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
    <NoteGroup
      className={isOver ? "ring-2 ring-primary/60 bg-primary/10 border-primary/40" : ""}
      ref={setNodeRef}
    >
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
    <div
      className={twMerge(
        "rounded-lg border transition-all duration-150",
        voted ? "border-primary/50 bg-primary/5" : "border-border/60",
      )}
    >
      <div className="p-1.5 space-y-1.5">{children}</div>

      <div
        className={twMerge(
          "flex justify-end px-2 py-1.5 border-t rounded-b-lg bg-muted/40",
          voted ? "border-primary/20" : "border-border/40",
        )}
      >
        <Button
          variant={voted ? "default" : "ghost"}
          size="sm"
          onClick={() => onVote(!voted)}
          disabled={!voted && !canVote}
        >
          {voted ? <X className="size-3" /> : <Check className="size-3" />}
          {voted ? "Remove vote" : "Vote"}
        </Button>
      </div>
    </div>
  );
}
