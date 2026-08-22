#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { verifyPlaywrightCleanRun } from "../../lib/qa/playwright-clean-run.mjs";

const reportFile =
  process.argv[2] ??
  process.env.QA_PLAYWRIGHT_RESULTS_FILE ??
  ".qa-run/playwright-results.json";

try {
  const report = JSON.parse(await readFile(reportFile, "utf8"));
  console.log(
    JSON.stringify({ ok: true, ...verifyPlaywrightCleanRun(report) }),
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Playwright clean-run gate failed: unknown-error",
  );
  process.exitCode = 1;
}
