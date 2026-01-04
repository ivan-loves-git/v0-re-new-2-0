/**
 * Test Assertion Helpers
 *
 * Utility functions for making test assertions.
 */

import type { AssertionResult, TestResult, TestError } from "../types"

/**
 * Assert that a value is truthy
 */
export function assertTrue(
  value: unknown,
  message: string = "Expected value to be truthy"
): AssertionResult {
  return {
    passed: !!value,
    message: !!value ? message : `Assertion failed: ${message}`,
    expected: true,
    actual: !!value,
  }
}

/**
 * Assert that a value is falsy
 */
export function assertFalse(
  value: unknown,
  message: string = "Expected value to be falsy"
): AssertionResult {
  return {
    passed: !value,
    message: !value ? message : `Assertion failed: ${message}`,
    expected: false,
    actual: !!value,
  }
}

/**
 * Assert that two values are equal
 */
export function assertEqual<T>(
  actual: T,
  expected: T,
  message: string = "Values should be equal"
): AssertionResult {
  const passed = actual === expected
  return {
    passed,
    message: passed ? message : `${message}: expected ${expected}, got ${actual}`,
    expected,
    actual,
  }
}

/**
 * Assert that two values are not equal
 */
export function assertNotEqual<T>(
  actual: T,
  notExpected: T,
  message: string = "Values should not be equal"
): AssertionResult {
  const passed = actual !== notExpected
  return {
    passed,
    message: passed ? message : `${message}: got ${actual} (should not equal ${notExpected})`,
    expected: `not ${notExpected}`,
    actual,
  }
}

/**
 * Assert that a number is greater than another
 */
export function assertGreaterThan(
  actual: number,
  threshold: number,
  message: string = "Value should be greater"
): AssertionResult {
  const passed = actual > threshold
  return {
    passed,
    message: passed ? message : `${message}: ${actual} is not > ${threshold}`,
    expected: `> ${threshold}`,
    actual,
  }
}

/**
 * Assert that a number is greater than or equal to another
 */
export function assertGreaterThanOrEqual(
  actual: number,
  threshold: number,
  message: string = "Value should be greater or equal"
): AssertionResult {
  const passed = actual >= threshold
  return {
    passed,
    message: passed ? message : `${message}: ${actual} is not >= ${threshold}`,
    expected: `>= ${threshold}`,
    actual,
  }
}

/**
 * Assert that a string contains a substring
 */
export function assertContains(
  haystack: string,
  needle: string,
  message: string = "String should contain substring"
): AssertionResult {
  const passed = haystack.includes(needle)
  return {
    passed,
    message: passed ? message : `${message}: "${haystack}" does not contain "${needle}"`,
    expected: `contains "${needle}"`,
    actual: haystack,
  }
}

/**
 * Assert that an array has a specific length
 */
export function assertLength(
  array: unknown[],
  expectedLength: number,
  message: string = "Array should have expected length"
): AssertionResult {
  const passed = array.length === expectedLength
  return {
    passed,
    message: passed ? message : `${message}: expected length ${expectedLength}, got ${array.length}`,
    expected: expectedLength,
    actual: array.length,
  }
}

/**
 * Assert that a value is not null or undefined
 */
export function assertExists(
  value: unknown,
  message: string = "Value should exist"
): AssertionResult {
  const passed = value !== null && value !== undefined
  return {
    passed,
    message: passed ? message : `${message}: value is ${value}`,
    expected: "not null/undefined",
    actual: value,
  }
}

/**
 * Assert that a value is null or undefined
 */
export function assertNotExists(
  value: unknown,
  message: string = "Value should not exist"
): AssertionResult {
  const passed = value === null || value === undefined
  return {
    passed,
    message: passed ? message : `${message}: value is ${value}`,
    expected: "null/undefined",
    actual: value,
  }
}

/**
 * Create a passing TestResult
 */
export function pass(name: string, message: string, duration: number = 0): TestResult {
  return {
    name,
    status: "passed",
    message,
    duration,
  }
}

/**
 * Create a failing TestResult
 */
export function fail(
  name: string,
  message: string,
  error?: Partial<TestError>,
  duration: number = 0
): TestResult {
  return {
    name,
    status: "failed",
    message,
    duration,
    error: {
      type: error?.type || "assertion",
      message: error?.message || message,
      stack: error?.stack,
      screenshot: error?.screenshot,
    },
  }
}

/**
 * Create a skipped TestResult
 */
export function skip(name: string, message: string = "Test skipped"): TestResult {
  return {
    name,
    status: "skipped",
    message,
    duration: 0,
  }
}

/**
 * Run an assertion and convert to TestResult
 */
export function assert(
  name: string,
  assertion: AssertionResult,
  duration: number = 0
): TestResult {
  if (assertion.passed) {
    return pass(name, assertion.message, duration)
  } else {
    return fail(name, assertion.message, { type: "assertion", message: assertion.message }, duration)
  }
}

/**
 * Combine multiple assertions - all must pass
 */
export function assertAll(assertions: AssertionResult[]): AssertionResult {
  const failed = assertions.filter(a => !a.passed)

  if (failed.length === 0) {
    return {
      passed: true,
      message: `All ${assertions.length} assertions passed`,
    }
  }

  return {
    passed: false,
    message: `${failed.length}/${assertions.length} assertions failed: ${failed.map(a => a.message).join("; ")}`,
  }
}
