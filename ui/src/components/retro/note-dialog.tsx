import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (content) {
      form.reset({ content });
    }
  }, [content, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
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
                    <Input className="w-full" autoComplete="off" {...field} />
                  </FormControl>

                  <FormDescription>Press enter to submit</FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
