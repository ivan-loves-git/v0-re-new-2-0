import { defineConfig } from "@playwright/test"

const outputDir = process.env.PW_TRACE_FIXTURE_OUTPUT
if (!outputDir) throw new Error("PW_TRACE_FIXTURE_OUTPUT is required")

export default defineConfig({
  testDir: ".",
  testMatch: "multi-context.fixture.ts",
  outputDir,
  retries: 1,
  reporter: "line",
  workers: 1,
  use: { trace: "on-first-retry" },
})
