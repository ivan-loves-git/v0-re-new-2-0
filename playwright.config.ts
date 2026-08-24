import { defineConfig, devices } from "@playwright/test"

const githubRunner = process.env.QA_EXECUTION_MODE === "github-runner"

if (!process.env.QA_BROWSER_BASE_URL) throw new Error("QA_BROWSER_BASE_URL is required")
if (!githubRunner && !process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required")
}

export default defineConfig({
  testDir: "./tests/golden",
  globalSetup: "./tests/golden/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  globalTimeout: 12 * 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: ".qa-run/test-results",
  reporter: [
    ["line"],
    ["json", { outputFile: ".qa-run/playwright-results.json" }],
    ["html", { outputFolder: ".qa-run/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.QA_BROWSER_BASE_URL,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "off",
    trace: "on-first-retry",
    video: "off",
    ...(githubRunner ? { ignoreHTTPSErrors: true } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
})
