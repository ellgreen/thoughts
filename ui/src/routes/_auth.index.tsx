import Container from "@/components/container";
import Creator from "@/components/retro/creator";
import Hero from "@/components/retro/hero";
import List from "@/components/retro/list";
import { api } from "@/lib/api";
import { panelVariants } from "@/lib/motion";
import { Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "motion/react";

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
    <Container className="space-y-6">
      <m.div variants={panelVariants} initial="initial" animate="animate">
        <Hero stats={stats} />
      </m.div>

      {/* The list leads now; creating a retro is one click behind a dialog
          rather than a permanently open form taking half the page. */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Recent retros</h2>
        <Creator />
      </div>

      <List retros={retros} />
    </Container>
  );
}
