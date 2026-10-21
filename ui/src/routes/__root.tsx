import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand";
import { button } from "@/components/ui";
import { messageOf } from "@/lib/api";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => (
    <Plain heading="Nothing printed here" body="That link doesn't go anywhere. It may have a typo, or the retro may have moved." />
  ),
  errorComponent: ({ error }) => <Plain heading="That didn't work" body={messageOf(error)} />,
});

function Plain({ heading, body }: { heading: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <Link to="/" aria-label="thoughts, home" className="self-start">
        <Wordmark />
      </Link>
      <h1 className="font-display text-4xl leading-tight">{heading}</h1>
      <p className="text-lg">{body}</p>
      <Link to="/" className={`${button.line} self-start`}>
        Go to your retros
      </Link>
    </main>
  );
}
