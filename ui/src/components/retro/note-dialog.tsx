import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Kbd } from "@/components/ui/kbd";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(2).max(255),
});

export default function NoteDialog({
  title,
  description,
  children,
  content,
  onContentSave,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  content?: string;
  onContentSave: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      content: content ?? "",
    },
  });

  const handleSubmit: SubmitHandler<FieldValues> = (data) => {
    setOpen(false);
    onContentSave(data.content);
  };

  function handleOpenChange(next: boolean) {
    setOpen(next);

    // Reopening should show what the note says now, not the last thing typed
    // into this dialog or someone else's live edit.
    if (next) {
      form.reset({ content: content ?? "" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="w-full" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>

                  <FormControl>
                    <AutoTextarea
                      className="w-full"
                      autoComplete="off"
                      autoFocus
                      maxLength={255}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.shiftKey) return;

                        // Shift+Enter still makes a newline; plain Enter
                        // would otherwise just add one via the textarea's
                        // own default.
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }}
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-4">
              <Button type="submit">
                Save
                <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                  ↵
                </Kbd>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
