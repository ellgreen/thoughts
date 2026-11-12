import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { KeyboardLayer } from "@/keys/layer";
import { meQuery } from "@/lib/session";

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
  const onBoard = useLocation({ select: (l) => l.pathname.startsWith("/retros/") });

  return (
    <div className="flex min-h-dvh flex-col gap-8 px-4 py-5 sm:px-6">
      {!onBoard && (
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" aria-label="thoughts, home">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu name={me?.user.name ?? ""} />
          </div>
        </header>
      )}
      <Outlet />
      <KeyboardLayer />
    </div>
  );
}
