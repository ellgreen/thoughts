import { Cog } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useRetro from "@/hooks/use-retro";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "../ui/checkbox";
import { createSocketEvent, PayloadRetroUpdate, SocketEvent } from "@/events";
import { Retro } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";

const schema = z.object({
  title: z.string().min(5).max(255),
  unlisted: z.boolean(),
  max_votes: z.coerce.number().int().min(1).max(15),
});

export default function Settings() {
  const {
    retro,
    setRetro,
    socket: { sendJsonMessage, lastJsonMessage },
  } = useRetro();
  const { toast } = useToast();

  function handleSubmit(data: PayloadRetroUpdate) {
    sendJsonMessage(createSocketEvent("retro_update", data));
  }

  useEffect(() => {
    if (!lastJsonMessage) return;

    const event = lastJsonMessage as SocketEvent;

    if (event.name === "retro_updated") {
      setRetro(event.payload as Retro);

      toast({
        title: "Settings updated",
        description: "The settings for this retrospective been updated.",
      });
    }
  }, [lastJsonMessage]);

  return <SettingsDialog retro={retro} onSave={handleSubmit} />;
}

function SettingsDialog({
  retro,
  onSave,
}: {
  retro: Retro;
  onSave: (data: z.infer<typeof schema>) => void;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    values: {
      title: retro.title,
      unlisted: retro.unlisted,
      max_votes: retro.max_votes,
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Cog />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retro Settings</DialogTitle>
          <DialogDescription>
            Update the settings for your retrospective here.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="w-full space-y-4"
            onSubmit={form.handleSubmit((data) => {
              onSave(data);

              setOpen(false);
            })}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Teams Retro - Sprint 99"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_votes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Votes</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>
                    The maximum number of votes each participant can cast in the
                    voting stage.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unlisted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Unlisted</FormLabel>
                    <FormDescription>
                      If checked, the retrospective will not be listed on the
                      home page.
                    </FormDescription>
                  </div>

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
