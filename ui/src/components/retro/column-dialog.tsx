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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RetroColumn } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Mirrors the server's column validation.
const schema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(255),
});

export type ColumnData = z.infer<typeof schema>;

export default function ColumnDialog({
  children,
  title,
  description,
  column,
  onSave,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  column?: RetroColumn;
  onSave: (data: ColumnData) => void;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: column?.title ?? "",
      description: column?.description ?? "",
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);

    // Reopening should show what the column says now, not a half-finished edit
    // or someone else's live rename.
    if (next) {
      form.reset({
        title: column?.title ?? "",
        description: column?.description ?? "",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="w-full space-y-4"
            onSubmit={form.handleSubmit((data) => {
              setOpen(false);
              onSave(data);
            })}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Went well" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What should we keep doing?" {...field} />
                  </FormControl>
                  <FormDescription>
                    A prompt to help people fill this column in. Optional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
