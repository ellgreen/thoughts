import { FileText } from "lucide-react";
import { Button } from "../ui/button";
import useRetro from "@/hooks/use-retro";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useState } from "react";
import { Textarea } from "../ui/textarea";

export default function Download() {
  const { retro } = useRetro();
  const [markdown, setMarkdown] = useState<string>("");
  const [showDialog, setShowDialog] = useState<boolean>(false);

  function handleClick() {
    api.get(`/api/retros/${retro.id}/markdown`).then((response) => {
      setMarkdown(response.data);
      setShowDialog(true);
    });
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <Button
        onClick={handleClick}
        variant="outline"
        size="sm"
        title="Show markdown"
      >
        <FileText />
      </Button>
      <DialogContent className="min-w-3xl max-w-3xl max-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Markdown</DialogTitle>
          <DialogDescription>
            The markdown export for this retrospective.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          readOnly={true}
          value={markdown}
          className="h-full min-h-[20vh] overflow-auto"
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
