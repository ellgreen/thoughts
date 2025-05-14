import { Error, NotFoundError } from "@/components/error";
import { Toaster } from "@/components/ui/sonner";
import { AuthContext } from "@/hooks/use-auth";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

interface MyRouterContext {
  auth: AuthContext;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RouteComponent,
  errorComponent: Error,
  notFoundComponent: NotFoundError,
});

function RouteComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
