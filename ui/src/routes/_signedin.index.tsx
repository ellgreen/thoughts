import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "react-aria-components";
import { CreateRetro } from "@/components/create-retro";
import { RetroList } from "@/components/retro-list";
import { button } from "@/components/ui";
import { Kbd, useShortcut } from "@/keys/keys";
import { retrosQuery, teamsQuery } from "@/lib/retro";
import { Teams } from "@/components/teams";

export const Route = createFileRoute("/_signedin/")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(retrosQuery), context.queryClient.ensureQueryData(teamsQuery)]),
  component: Home,
});

function Home() {
  const { data: retros } = useSuspenseQuery(retrosQuery);
  const [creating, setCreating] = useState(false);
  useShortcut({ id: "new-retro", keys: "c", label: "Start a new retro", section: "Anywhere", run: () => setCreating(true) });

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl leading-none">Retros</h1>
        <Button onPress={() => setCreating(true)} className={button.solid}>
          New retro <Kbd keys="c" />
        </Button>
      </div>
      <Teams />
      <h2 className="font-display text-3xl">Recent retros</h2>
      {retros.length === 0 ? (
        <p className="max-w-[48ch] text-lg">Nothing here yet. Start a retro, then send its link to your team. They sign in and land straight in it.</p>
      ) : (
        <RetroList retros={retros} />
      )}
      <CreateRetro isOpen={creating} onOpenChange={setCreating} />
    </main>
  );
}
