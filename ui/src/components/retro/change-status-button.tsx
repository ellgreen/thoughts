import { RetroStatus } from "@/types";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const variants = {
  next: {
    brainstorm: ["group", "Group", "Proceed to grouping stage?"],
    group: ["vote", "Vote", "Done grouping? Proceed to vote."],
    vote: ["discuss", "Discuss", "Done voting? Proceed to discussion."],
    discuss: [],
  },
  prev: {
    brainstorm: [],
    discuss: ["vote", "Vote", "Back to voting stage?"],
    vote: ["group", "Group", "Back to grouping stage?"],
    group: ["brainstorm", "Brainstorm", "Back to brainstorming stage?"],
  },
};

export default function ChangeStatusButton({
  variant,
  status,
  onStatusUpdate,
}: {
  variant: keyof typeof variants;
  status: RetroStatus;
  onStatusUpdate: (status: RetroStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  if (variant === "next" && status === "discuss") {
    return null;
  }

  if (variant === "prev" && status === "brainstorm") {
    return null;
  }

  const [newStatus, buttonText, title] = variants[variant][status];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant === "next" ? "default" : "secondary"}
          size="sm"
        >
          {variant === "prev" && <ChevronsLeft />} {buttonText}{" "}
          {variant === "next" && <ChevronsRight />}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Make sure everyone is ready before moving to the{" "}
            {variant === "next" ? "next " : "previous "}
            stage!
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
              setOpen(false);
              onStatusUpdate(newStatus as RetroStatus);
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
