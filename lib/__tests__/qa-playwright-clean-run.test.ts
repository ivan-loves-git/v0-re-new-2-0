import { describe, expect, it } from "vitest";
import { verifyPlaywrightCleanRun } from "@/lib/qa/playwright-clean-run.mjs";

const JOURNEYS = [
  "P1 public application persists one profile and one CV",
  "P2 staff validation and two-tab retry persist one normalized profile",
  "P3 proposal interest retry and staff validation agree after reload",
];

function report() {
  return {
    suites: [
      {
        title: "golden-journeys.spec.ts",
        suites: [
          {
            title: "Golden journeys",
            specs: JOURNEYS.map((title) => ({
              title,
              tests: [
                {
                  expectedStatus: "passed",
                  status: "expected",
                  results: [{ status: "passed", retry: 0 }],
                },
              ],
            })),
          },
        ],
      },
    ],
    errors: [],
    stats: { expected: 3, skipped: 0, unexpected: 0, flaky: 0 },
  };
}

describe("Playwright clean-run gate", () => {
  it("accepts exactly P1-P3 when every journey passes on its first attempt", () => {
    expect(verifyPlaywrightCleanRun(report())).toEqual({
      expected: 3,
      flaky: 0,
      journeys: JOURNEYS,
      skipped: 0,
      unexpected: 0,
    });
  });

  it.each([
    [
      "passed on retry",
      (value: any) => {
        value.suites[0].suites[0].specs[0].tests[0].results = [
          { status: "failed", retry: 0 },
          { status: "passed", retry: 1 },
        ];
        value.stats.flaky = 1;
      },
    ],
    [
      "flaky",
      (value: any) => {
        value.stats.flaky = 1;
      },
    ],
    [
      "skipped",
      (value: any) => {
        value.suites[0].suites[0].specs[1].tests[0].status = "skipped";
        value.suites[0].suites[0].specs[1].tests[0].results = [];
        value.stats.expected = 2;
        value.stats.skipped = 1;
      },
    ],
    [
      "missing journey",
      (value: any) => {
        value.suites[0].suites[0].specs.pop();
        value.stats.expected = 2;
      },
    ],
    [
      "duplicate journey",
      (value: any) => {
        value.suites[0].suites[0].specs[2].title = JOURNEYS[1];
      },
    ],
  ])("rejects a %s report", (_name, mutate) => {
    const value = report();
    mutate(value);
    expect(() => verifyPlaywrightCleanRun(value)).toThrow(
      /Playwright clean-run gate failed:/,
    );
  });
});
