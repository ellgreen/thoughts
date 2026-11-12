import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import "@fontsource/bagel-fat-one/latin.css";
import "@fontsource/bagel-fat-one/latin-ext.css";
import "@fontsource-variable/familjen-grotesk";
import { ToastProvider } from "./components/toast";
import { KeysProvider } from "./keys/keys";
import { queryClient, router } from "./router";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <KeysProvider>
        <ToastProvider>
          <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
            <RouterProvider router={router} />
          </MotionConfig>
        </ToastProvider>
      </KeysProvider>
    </QueryClientProvider>
  </StrictMode>,
);
