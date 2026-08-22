export const EXPECTED_GOLDEN_JOURNEYS = Object.freeze([
  "P1 public application persists one profile and one CV",
  "P2 staff validation and two-tab retry persist one normalized profile",
  "P3 proposal interest retry and staff validation agree after reload",
]);

function fail(code) {
  throw new Error(`Playwright clean-run gate failed: ${code}`);
}

function collectSpecs(suites, collected = []) {
  if (!Array.isArray(suites)) fail("suites");
  for (const suite of suites) {
    if (!suite || typeof suite !== "object") fail("suite");
    if (suite.specs !== undefined && !Array.isArray(suite.specs)) fail("specs");
    collected.push(...(suite.specs ?? []));
    if (suite.suites !== undefined) collectSpecs(suite.suites, collected);
  }
  return collected;
}

export function verifyPlaywrightCleanRun(report) {
  if (!report || typeof report !== "object" || Array.isArray(report))
    fail("report");
  if (!Array.isArray(report.errors) || report.errors.length !== 0)
    fail("report-errors");

  const stats = report.stats;
  if (!stats || typeof stats !== "object") fail("stats");
  for (const [name, expected] of Object.entries({
    expected: 3,
    skipped: 0,
    unexpected: 0,
    flaky: 0,
  })) {
    if (stats[name] !== expected) fail(`stats-${name}`);
  }

  const specs = collectSpecs(report.suites);
  if (specs.length !== EXPECTED_GOLDEN_JOURNEYS.length) fail("journey-count");

  const titles = specs.map((spec) => spec?.title);
  if (titles.some((title) => typeof title !== "string")) fail("journey-title");
  if (new Set(titles).size !== titles.length) fail("duplicate-journey");
  for (const expectedTitle of EXPECTED_GOLDEN_JOURNEYS) {
    if (!titles.includes(expectedTitle)) fail("missing-journey");
  }

  for (const spec of specs) {
    if (!Array.isArray(spec.tests) || spec.tests.length !== 1)
      fail("test-count");
    const test = spec.tests[0];
    if (test.expectedStatus !== "passed" || test.status !== "expected")
      fail("test-status");
    if (!Array.isArray(test.results) || test.results.length !== 1)
      fail("attempt-count");
    const result = test.results[0];
    if (!result || result.status !== "passed" || result.retry !== 0)
      fail("first-attempt");
  }

  return {
    expected: stats.expected,
    flaky: stats.flaky,
    journeys: [...EXPECTED_GOLDEN_JOURNEYS],
    skipped: stats.skipped,
    unexpected: stats.unexpected,
  };
}
