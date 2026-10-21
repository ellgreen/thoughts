import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "react-aria-components";
import { CreateRetro } from "@/components/create-retro";
import { NewTeam } from "@/components/teams";
import { RetroList } from "@/components/retro-list";
import { button } from "@/components/ui";
import { formatDueOn, tagQuery } from "@/lib/retro";

// /tags/{tag} is v1's URL for everything filed under one tag.
export const Route = createFileRoute("/_signedin/tags/$tag")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(tagQuery(params.tag)),
  component: TagPage,
});

function TagPage() {
  const { tag: raw } = Route.useParams();
  const { data } = useSuspenseQuery(tagQuery(raw));
  const [creating, setCreating] = useState(false);
  const [teaming, setTeaming] = useState(false);

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="font-semibold text-ink-soft hover:underline">
            All retros
          </Link>
          <h1 className="font-display text-5xl leading-none">#{data.tag}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onPress={() => setTeaming(true)} className={button.line}>
            Make this a team
          </Button>
          <Button onPress={() => setCreating(true)} className={button.solid}>
            New retro for #{data.tag}
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-3 bg-pink-tint p-5" aria-labelledby="open-actions">
        <h2 id="open-actions" className="font-display text-3xl">
          Still to do
        </h2>
        {data.openActions.length === 0 ? (
          <p>Nothing open. Every action from these retros is done.</p>
        ) : (
          <ul className="flex flex-col">
            {data.openActions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b-[2px] border-ink py-2">
                <span className="font-semibold">{a.what}</span>
                <span className="text-sm">
                  {[a.who, a.dueOn && `by ${formatDueOn(a.dueOn)}`].filter(Boolean).join(", ")}
                  {" · "}
                  <Link to="/retros/$retroId" params={{ retroId: a.retroId }} className="underline underline-offset-4">
                    {a.retroTitle}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.retros.length === 0 ? <p className="text-lg">No listed retros have this tag yet.</p> : <RetroList retros={data.retros} />}
      <CreateRetro isOpen={creating} onOpenChange={setCreating} tag={data.tag} />
      <NewTeam isOpen={teaming} onOpenChange={setTeaming} fromTag={data.tag} />
    </main>
  );
}
