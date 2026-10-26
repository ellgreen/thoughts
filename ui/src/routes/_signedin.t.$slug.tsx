import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "react-aria-components";
import { CreateRetro } from "@/components/create-retro";
import { RetroList } from "@/components/retro-list";
import { button } from "@/components/ui";
import { Kbd, useShortcut } from "@/keys/keys";
import { ApiError } from "@/lib/api";
import { formatDueOn, teamQuery } from "@/lib/retro";

export const Route = createFileRoute("/_signedin/t/$slug")({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(teamQuery(params.slug));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.team.name} · thoughts` : "thoughts" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(teamQuery(slug));
  const [creating, setCreating] = useState(false);
  useShortcut({ id: "new-retro", keys: "c", label: `Start a retro for ${data.team.name}`, section: "Anywhere", run: () => setCreating(true) });

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="font-semibold text-ink-soft hover:underline">
            All retros
          </Link>
          <h1 className="font-display text-5xl leading-none">{data.team.name}</h1>
        </div>
        <Button onPress={() => setCreating(true)} className={button.solid}>
          New retro <Kbd keys="c" />
        </Button>
      </div>

      <section className="flex flex-col gap-3 bg-pink-tint p-5" aria-labelledby="open-actions">
        <h2 id="open-actions" className="font-display text-3xl">
          Still to do
        </h2>
        {data.openActions.length === 0 ? (
          <p>Nothing open. The next retro starts with a clean slate.</p>
        ) : (
          <>
            <p className="text-sm">The next retro for {data.team.name} opens with these, so the room can tick them off, carry them over or drop them.</p>
            <ul className="flex flex-col">
              {data.openActions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b-[2px] border-ink py-2">
                  <span className="font-semibold">{a.what}</span>
                  <span className="text-sm">
                    {[a.who, a.dueOn && `by ${formatDueOn(a.dueOn)}`].filter(Boolean).join(", ")}
                    {(a.who || a.dueOn) && " · "}
                    <Link to="/retros/$retroId" params={{ retroId: a.retroId }} className="underline underline-offset-4">
                      {a.retroTitle}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {data.retros.length === 0 ? <p className="text-lg">No retros for this team yet. Start the first one.</p> : <RetroList retros={data.retros} />}
      <CreateRetro isOpen={creating} onOpenChange={setCreating} teamId={data.team.id} />
    </main>
  );
}
