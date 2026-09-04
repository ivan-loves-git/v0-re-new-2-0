import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e/opening-readiness",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: process.env.RUNNER_TEMP
    ? `${process.env.RUNNER_TEMP}/opening-readiness-playwright`
    : "test-results/opening-readiness",
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    // Reset-link tokens must never be retained in a CI trace artifact. The
    // fixture writes its own privacy-safe state evidence after each assertion.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3000",
    url: `${baseURL}/auth/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
