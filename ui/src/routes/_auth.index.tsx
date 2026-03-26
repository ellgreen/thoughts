import Creator from "@/components/retro/creator";
import Hero from "@/components/retro/hero";
import List from "@/components/retro/list";
import { api } from "@/lib/api";
import { Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/")({
  component: RouteComponent,
  loader: async () => {
    const [retrosRes, statsRes] = await Promise.all([
      api.get<Retro[]>("/api/retros"),
      api.get<{ retro_count: number; note_count: number; task_count: number }>(
        "/api/stats",
      ),
    ]);

    return {
      retros: retrosRes.status === 200 ? retrosRes.data : [],
      stats:
        statsRes.status === 200
          ? statsRes.data
          : { retro_count: 0, note_count: 0, task_count: 0 },
    };
  },
});

function RouteComponent() {
  const { retros, stats } = Route.useLoaderData();

  return (
    <div className="max-w-400 mx-auto px-8 space-y-6">
      <Hero stats={stats} />

      <div className="grid grid-cols-2 gap-6 items-start">
        <Creator />
        <List retros={retros} />
      </div>
    </div>
  );
}
