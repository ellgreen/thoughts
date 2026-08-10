import path from "path";
import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts: the router plugin regenerates the route
// tree on start, which tests neither need nor should trigger.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
