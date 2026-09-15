import { defineConfig } from "@playwright/test";

// Runs against the real production binary (task build && task run) rather
// than the Vite dev server, so the WebSocket/session/obfuscation behaviour
// under test is exactly what ships.
//
// Override THOUGHTS_E2E_PORT locally if 3000 is already taken by a dev
// server - task run picks it up as THOUGHTS_ADDRESS.
const port = process.env.THOUGHTS_E2E_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "task run",
    cwd: "..",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Keeps e2e runs off a real dev database.
      THOUGHTS_DATA_PATH: "./tmp/e2e-data",
      THOUGHTS_ADDRESS: `localhost:${port}`,
    },
  },
});
