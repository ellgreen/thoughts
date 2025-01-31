import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import { api } from "@/lib/api";
import { useState } from "react";

const schema = z.object({
  query: z.string().min(2).max(32),
});

interface SearchResult {
  preview_url: string;
  url: string;
}

export default function GIFDialog({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const [results, setResults] = useState<SearchResult[]>([]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      query: "",
    },
  });

  function handleSubmit(data: z.infer<typeof schema>) {
    api
      .post<SearchResult[]>("/api/gifs", {
        q: data.query,
      })
      .then((res) => {
        setResults(res.data);
      });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a GIF</DialogTitle>
          <DialogDescription>
            Search for a GIF to add to your note.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="w-full" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      className="w-full"
                      placeholder="dancing cat"
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>Press enter to search</FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <ul className="grid grid-cols-3 gap-4">
          {results.map((result, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  setOpen(false);

                  onSelect(result.url);
                }}
                className="border-2 rounded p-2 hover:border-primary hover:scale-110 transition-all duration-100"
              >
                <img src={result.preview_url} />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
