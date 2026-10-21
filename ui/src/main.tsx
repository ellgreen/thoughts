import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
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
          <RouterProvider router={router} />
        </ToastProvider>
      </KeysProvider>
    </QueryClientProvider>
  </StrictMode>,
);
