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
import { GiphyFetch } from "@giphy/js-fetch-api";
import { useState } from "react";

const schema = z.object({
  query: z.string().min(2).max(255),
});

interface GIF {
  images: {
    downsized: {
      url: string;
    };
  };
}

export default function GIFDialog({ children }: { children: React.ReactNode }) {
  const [results, setResults] = useState<GIF[]>([]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      query: "",
    },
  });

  function handleSubmit(data: z.infer<typeof schema>) {
    const gf = new GiphyFetch("MVutYl7BgFftZ5zkI9z8E5AAq7qI8eZ8");

    gf.search(data.query, { limit: 6, sort: "relevant", lang: "en" }).then(
      (res) => {
        console.log(res.data);
        setResults(res.data);
      },
    );
  }

  return (
    <Dialog>
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
              <img src={result.images.downsized.url} />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
