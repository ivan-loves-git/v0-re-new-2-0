import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["tooling/*.spec.ts", "opening-readiness/notification-dismissal.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 10_000,
  reporter: "line",
  outputDir: "test-results/tooling",
  use: { ...devices["Desktop Chrome"], trace: "off", screenshot: "off", video: "off" },
})
