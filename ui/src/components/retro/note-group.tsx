import { cardVariants, spring, springy } from "@/lib/motion";
import { useDroppable } from "@dnd-kit/core";
import { Check, Flame, TrendingUp, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import React, { Children } from "react";
import { twMerge } from "tailwind-merge";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// Omit children: motion widens it to accept MotionValues, which Children.count
// cannot deal with.
interface NoteGroupProps
  extends Omit<React.ComponentProps<typeof m.div>, "children"> {
  voteCount?: {
    forGroup: number;
    total: number;
  };
  authors?: string[];
  children?: React.ReactNode;
}

export const NoteGroup = ({
  voteCount,
  authors,
  className,
  children,
  ...props
}: NoteGroupProps) => {
  const hasVoteCount = voteCount !== undefined;
  const childCount = Children.count(children);
  const isGrouped = childCount > 1;
  const hasNonZeroVotes = hasVoteCount && voteCount.forGroup > 0;
  const showFooter = authors || hasNonZeroVotes;

  return (
    <m.div
      layout="position"
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring}
      className={twMerge(
        "rounded-xl",
        isGrouped || hasVoteCount
          ? "space-y-2 bg-surface p-2 ring-1 ring-border/60"
          : "space-y-1",
        className,
      )}
      {...props}
    >
      {children}

      {showFooter && (
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          {authors && (
            <span className="truncate text-xs text-muted-foreground">
              {authors.join(", ")}
            </span>
          )}

          {hasNonZeroVotes && (
            <VoteCount forGroup={voteCount.forGroup} total={voteCount.total} />
          )}
        </div>
      )}
    </m.div>
  );
};

const hotThreshold = 0.098;

function VoteCount({ forGroup, total }: { forGroup: number; total: number }) {
  if (forGroup === 0 || total === 0) return null;

  const isHot = forGroup / total >= hotThreshold;
  const Icon = isHot ? Flame : TrendingUp;

  return (
    <m.div
      // Springs in whenever the count changes, so a vote landing is visible
      // without anyone watching the number.
      key={`${forGroup}-${isHot}`}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springy}
    >
      <Badge variant={isHot ? "destructive" : "secondary"} className="gap-1">
        <Icon className="size-3.5" /> {forGroup}
      </Badge>
    </m.div>
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
      ref={setNodeRef}
      className={
        isOver
          ? "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] ring-2 ring-[color-mix(in_oklch,var(--accent)_55%,transparent)]"
          : ""
      }
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
    <m.div
      layout="position"
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring}
      className={twMerge(
        "overflow-hidden rounded-xl ring-1 transition-colors duration-200",
        voted
          ? "bg-[color-mix(in_oklch,var(--accent)_7%,transparent)] ring-[color-mix(in_oklch,var(--accent)_50%,transparent)]"
          : "ring-border/60",
      )}
    >
      <div className="space-y-1.5 p-1.5">{children}</div>

      <div
        className={twMerge(
          "flex justify-end border-t px-2 py-1.5",
          voted
            ? "border-[color-mix(in_oklch,var(--accent)_25%,transparent)] bg-[color-mix(in_oklch,var(--accent)_5%,transparent)]"
            : "border-border/40 bg-muted/40",
        )}
      >
        <Button
          variant={voted ? "default" : "ghost"}
          size="sm"
          onClick={() => onVote(!voted)}
          disabled={!voted && !canVote}
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={voted ? "voted" : "not-voted"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springy}
              className="flex items-center gap-1.5"
            >
              {voted ? <X className="size-3" /> : <Check className="size-3" />}
              {voted ? "Remove vote" : "Vote"}
            </m.span>
          </AnimatePresence>
        </Button>
      </div>
    </m.div>
  );
}
