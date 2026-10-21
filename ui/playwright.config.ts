import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.THOUGHTS_E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `cd .. && THOUGHTS_ADDRESS=localhost:${port} THOUGHTS_DATA_PATH="$(mktemp -d)" ./build/thoughts`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
