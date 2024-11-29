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
import { useState } from "react";
import { z } from "zod";
import { Button } from "../ui/button";
import { DatePickerFormItem } from "../date-picker";
import { useForm } from "react-hook-form";

const schema = z.object({
  who: z.string().min(1),
  what: z.string().min(3),
  when: z.date({
    required_error: "The date for when this action is due by, is required.",
  }),
});

interface TaskData {
  who: string;
  what: string;
  when: string | Date;
}

export default function TaskDialog({
  title,
  description,
  children,
  data,
  onSave,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  data?: TaskData;
  onSave: (data: TaskData) => void;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      who: data?.who ?? "",
      what: data?.what ?? "",
      when: data?.when ?? "",
    },
  });

  function handleSubmit(data: TaskData) {
    setOpen(false);
    onSave(data);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="w-full space-y-4"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="what"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What</FormLabel>

                  <FormDescription>What needs to be done?</FormDescription>

                  <FormControl>
                    <Input className="w-full" {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="who"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Who</FormLabel>

                  <FormDescription>
                    Who will be completing this action?
                  </FormDescription>

                  <FormControl>
                    <Input className="w-full" {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="when"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When</FormLabel>

                  <FormDescription>
                    When does this need to be done?
                  </FormDescription>

                  <DatePickerFormItem
                    value={field.value}
                    onChange={field.onChange}
                  />

                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Save</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
