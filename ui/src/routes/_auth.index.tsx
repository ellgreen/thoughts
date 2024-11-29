import Creator from "@/components/retro/creator";
import List from "@/components/retro/list";
import { api } from "@/lib/api";
import { Retro } from "@/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/")({
  component: RouteComponent,
  loader: async () => {
    const res = await api.get<Retro[]>("/api/retros");

    if (!res) {
      throw new Error("Failed to fetch retros");
    }

    switch (res.status) {
      case 200:
        return res.data;
      case 401:
        throw new Error("Unauthorized");
      case 500:
        throw new Error("Failed to fetch retros");
    }

    throw new Error("Failed to fetch retros");
  },
});

function RouteComponent() {
  const retros = Route.useLoaderData();

  return (
    <div className="grid grid-cols-3 gap-6">
      <Creator className="col-span-2" />
      <List retros={retros} />
    </div>
  );
}
