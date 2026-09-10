import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    channel: "chrome",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npx tsx scripts/start-test-server.ts",
    url: "http://localhost:3001/api/ping",
    reuseExistingServer: false,
    timeout: 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
