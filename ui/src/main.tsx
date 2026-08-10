import { RouterProvider } from "@tanstack/react-router";
import { domMax, LazyMotion, MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthProvider from "./components/auth.tsx";
import ThemeProvider from "./components/theme.tsx";
import { useAuth } from "./hooks/use-auth.ts";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./index.css";
import { router } from "./router.tsx";

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

function App() {
  return (
    // reducedMotion="user" honours the OS setting everywhere at once, so no
    // component has to remember to check it.
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
