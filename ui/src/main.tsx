import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthProvider from "./components/auth.tsx";
import ThemeProvider from "./components/theme.tsx";
import { useAuth } from "./hooks/use-auth.ts";
import "./index.css";
import { router } from "./router.tsx";

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system">
        <InnerApp />
      </ThemeProvider>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
