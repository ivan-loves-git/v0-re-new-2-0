/**
 * E2E Test Runner - ReNew Platform
 *
 * Main orchestrator for running all E2E tests.
 *
 * This file defines the test execution flow. Tests are executed by Claude
 * using browser automation tools (MCP chrome extension).
 *
 * Usage:
 *   Ask Claude: "Run the E2E tests for ReNew Platform"
 *   Claude will read these test definitions and execute them using browser automation.
 */

import type {
  TestSuite,
  TestContext,
  TestResult,
  SuiteResult,
  TestReport
} from "./types"
import { TEST_CONFIG, ROUTES } from "./config"

// Import test suites
import { authTests } from "./tests/auth.test"
import { dashboardTests } from "./tests/dashboard.test"
import { repreneursTests } from "./tests/repreneurs.test"
import { questionnaireTests } from "./tests/questionnaire.test"
import { pipelineTests } from "./tests/pipeline.test"
import { journeyTests } from "./tests/journey.test"
import { offersTests } from "./tests/offers.test"
import { dataValidationTests } from "./tests/data-validation.test"

// Import utilities
import { createDataValidator } from "./utils/supabase"
import { createTestDataManager, seedStandardTestData } from "./utils/test-data"
import { createReport, saveReport, printSummary } from "./utils/report"
import { pass, fail, skip } from "./utils/assertions"

/**
 * All test suites in execution order
 * Auth tests run first to establish session
 */
export const ALL_TEST_SUITES: TestSuite[] = [
  authTests,
  dashboardTests,
  repreneursTests,
  questionnaireTests,
  pipelineTests,
  journeyTests,
  offersTests,
  dataValidationTests,
]

/**
 * Test execution configuration
 */
export interface TestRunConfig {
  suites?: string[]        // Run only specific suites (by name)
  skipCleanup?: boolean    // Don't cleanup test data after run
  skipSeeding?: boolean    // Don't seed test data before run
  verbose?: boolean        // Extra logging
}

/**
 * Get test suites to run based on config
 */
export function getTestSuites(config?: TestRunConfig): TestSuite[] {
  if (!config?.suites || config.suites.length === 0) {
    return ALL_TEST_SUITES
  }

  return ALL_TEST_SUITES.filter(suite =>
    config.suites!.some(name =>
      suite.name.toLowerCase().includes(name.toLowerCase())
    )
  )
}

/**
 * Execute a single test suite
 */
export async function runSuite(
  suite: TestSuite,
  context: TestContext
): Promise<SuiteResult> {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`Running: ${suite.name}`)
  console.log(`${"=".repeat(60)}`)

  const results: TestResult[] = []
  const suiteStart = Date.now()

  // Run beforeAll hook if defined
  if (suite.beforeAll) {
    try {
      await suite.beforeAll(context)
    } catch (error: any) {
      console.error(`[${suite.name}] beforeAll failed:`, error.message)
    }
  }

  // Run each test
  for (const test of suite.tests) {
    // Skip if marked
    if (test.skip) {
      console.log(`  [SKIP] ${test.name}`)
      results.push(skip(test.name, "Marked as skip"))
      continue
    }

    // Run beforeEach hook if defined
    if (suite.beforeEach) {
      try {
        await suite.beforeEach(context)
      } catch (error: any) {
        console.error(`  [beforeEach] failed:`, error.message)
      }
    }

    // Execute the test
    console.log(`  Running: ${test.name}...`)
    try {
      const result = await test.run(context)
      results.push(result)

      const status = result.status === "passed" ? "[PASS]" : "[FAIL]"
      console.log(`  ${status} ${test.name} (${result.duration}ms)`)

      if (result.status === "failed" && result.error) {
        console.log(`         Error: ${result.error.message}`)
      }
    } catch (error: any) {
      const failResult = fail(test.name, error.message, {
        type: "unknown",
        stack: error.stack
      }, 0)
      results.push(failResult)
      console.log(`  [FAIL] ${test.name} - ${error.message}`)
    }

    // Run afterEach hook if defined
    if (suite.afterEach) {
      try {
        await suite.afterEach(context)
      } catch (error: any) {
        console.error(`  [afterEach] failed:`, error.message)
      }
    }
  }

  // Run afterAll hook if defined
  if (suite.afterAll) {
    try {
      await suite.afterAll(context)
    } catch (error: any) {
      console.error(`[${suite.name}] afterAll failed:`, error.message)
    }
  }

  const duration = Date.now() - suiteStart
  const passed = results.filter(r => r.status === "passed").length
  const failed = results.filter(r => r.status === "failed").length
  const skipped = results.filter(r => r.status === "skipped").length

  console.log(`\n[${suite.name}] Complete: ${passed}/${results.length} passed`)

  return {
    name: suite.name,
    results,
    duration,
    passed,
    failed,
    skipped,
  }
}

/**
 * Main test runner entry point
 *
 * This function is called by Claude to execute tests.
 * Claude provides the browser context via MCP tools.
 */
export async function runTests(
  context: TestContext,
  config?: TestRunConfig
): Promise<TestReport> {
  const startTime = Date.now()
  const screenshots: string[] = []
  const suiteResults: SuiteResult[] = []

  console.log("\n" + "=".repeat(60))
  console.log("E2E TEST RUN - ReNew Platform")
  console.log("=".repeat(60))
  console.log(`Target: ${TEST_CONFIG.baseUrl}`)
  console.log(`Started: ${new Date().toISOString()}`)
  console.log("=".repeat(60))

  // Setup: Clean previous test data
  if (TEST_CONFIG.testData.cleanupBefore && !config?.skipSeeding) {
    console.log("\n[Setup] Cleaning previous test data...")
    try {
      await context.testData.cleanup()
    } catch (error: any) {
      console.warn("[Setup] Cleanup warning:", error.message)
    }
  }

  // Setup: Seed fresh test data
  if (!config?.skipSeeding) {
    console.log("[Setup] Seeding test data...")
    try {
      await seedStandardTestData()
    } catch (error: any) {
      console.warn("[Setup] Seeding warning:", error.message)
    }
  }

  // Get suites to run
  const suitesToRun = getTestSuites(config)
  console.log(`\n[Info] Running ${suitesToRun.length} test suite(s)`)

  // Execute each suite
  for (const suite of suitesToRun) {
    const result = await runSuite(suite, context)
    suiteResults.push(result)

    // Collect screenshots from results
    for (const test of result.results) {
      if (test.screenshot) {
        screenshots.push(test.screenshot)
      }
    }
  }

  // Cleanup: Remove test data
  if (TEST_CONFIG.testData.cleanupAfter && !config?.skipCleanup) {
    console.log("\n[Cleanup] Removing test data...")
    try {
      await context.testData.cleanup()
    } catch (error: any) {
      console.warn("[Cleanup] Warning:", error.message)
    }
  }

  // Generate report
  const report = createReport(suiteResults, startTime, screenshots)

  // Save report to file
  try {
    const reportPath = saveReport(report)
    console.log(`\n[Report] Saved to: ${reportPath}`)
  } catch (error: any) {
    console.warn("[Report] Could not save:", error.message)
  }

  // Print summary to console
  printSummary(report)

  return report
}

/**
 * Export test configuration for Claude to understand what tests are available
 */
export function getTestInfo(): {
  suites: { name: string; testCount: number; tests: string[] }[]
  totalTests: number
  config: typeof TEST_CONFIG
} {
  const suites = ALL_TEST_SUITES.map(suite => ({
    name: suite.name,
    testCount: suite.tests.length,
    tests: suite.tests.map(t => t.name),
  }))

  const totalTests = suites.reduce((sum, s) => sum + s.testCount, 0)

  return {
    suites,
    totalTests,
    config: TEST_CONFIG,
  }
}

// Export everything needed for test execution
export {
  TEST_CONFIG,
  ROUTES,
  createDataValidator,
  createTestDataManager,
  seedStandardTestData,
  pass,
  fail,
  skip,
}
