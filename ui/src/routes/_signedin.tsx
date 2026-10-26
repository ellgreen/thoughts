import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from "react-aria-components";
import { Wordmark } from "@/components/brand";
import { button } from "@/components/ui";
import { Kbd } from "@/keys/keys";
import { KeyboardLayer } from "@/keys/layer";
import { meQuery, signOut } from "@/lib/session";

export const Route = createFileRoute("/_signedin")({
  beforeLoad: async ({ context, location }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery))) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: SignedIn,
});

function SignedIn() {
  const { data: me } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function leave() {
    await signOut();
    queryClient.setQueryData(meQuery.queryKey, null);
    await navigate({ to: "/login" });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/" aria-label="thoughts, home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-sm text-ink-soft sm:flex">
            <Kbd keys="?" /> shortcuts
          </span>
          <span className="font-semibold">{me?.user.name}</span>
          <Button onPress={leave} className={button.quiet}>
            Sign out
          </Button>
        </div>
      </header>
      <Outlet />
      <KeyboardLayer />
    </div>
  );
}
