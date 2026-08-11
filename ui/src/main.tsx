import { RouterProvider } from "@tanstack/react-router";
import { domMax, LazyMotion, MotionConfig } from "motion/react";
import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import AuthProvider from "./components/auth.tsx";
import ThemeProvider from "./components/theme.tsx";
import { Spinner } from "./components/ui/spinner.tsx";
import { useAuth } from "./hooks/use-auth.ts";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./index.css";
import { router } from "./router.tsx";

function InnerApp() {
  const auth = useAuth();
  const lastStatus = useRef(auth.status);

  // A stale session has to re-run the route guards, or whatever is on screen
  // keeps firing requests that will only ever 401.
  useEffect(() => {
    // Not on the first run: the router has no context yet, so beforeLoad
    // would read isAuthenticated off an undefined auth.
    if (lastStatus.current === auth.status) return;

    lastStatus.current = auth.status;

    router.invalidate();
  }, [auth.status]);

  // Guarded routes must not load until we know whether the session is real.
  if (auth.status === "pending") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth }} />;
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      {/* domMax rather than domAnimation: the board leans on layout and
          shared-element transitions. strict keeps us on `m.*`, so the full
          motion bundle can never sneak back in. */}
      <LazyMotion features={domMax} strict>
        <AuthProvider>
          <ThemeProvider defaultTheme="system">
            <InnerApp />
          </ThemeProvider>
        </AuthProvider>
      </LazyMotion>
    </MotionConfig>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
