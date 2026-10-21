import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { RetroBoard } from "@/components/board/board";
import { ApiError } from "@/lib/api";
import { retroQuery } from "@/lib/retro";
import { meQuery } from "@/lib/session";

// /retros/{id} is v1's URL, so links shared from v1 keep working.
export const Route = createFileRoute("/_signedin/retros/$retroId")({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(retroQuery(params.retroId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.title} · thoughts` : "thoughts" }] }),
  component: RetroPage,
});

function RetroPage() {
  const { retroId } = Route.useParams();
  const { data: me } = useSuspenseQuery(meQuery);
  return <RetroBoard key={retroId} retroId={retroId} me={me!.user.id} gifSearch={me!.features.gifSearch} ai={me!.features.ai} />;
}
