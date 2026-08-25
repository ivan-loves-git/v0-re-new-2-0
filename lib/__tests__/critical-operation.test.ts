import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const alertMocks = vi.hoisted(() => ({
  scheduleCriticalOperationAlert: vi.fn(),
}))

vi.mock("@/lib/observability/critical-operation-alert", () => alertMocks)

import { startCriticalOperation } from "@/lib/observability/critical-operation"

describe("critical operation runtime trace", () => {
  const originalEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_BUILD_VERSION: process.env.NEXT_PUBLIC_BUILD_VERSION,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    process.env.VERCEL_ENV = "preview"
    process.env.VERCEL_GIT_COMMIT_SHA = "dd65c28"
  })

  afterEach(() => {
    process.env.VERCEL_ENV = originalEnvironment.VERCEL_ENV
    process.env.VERCEL_GIT_COMMIT_SHA =
      originalEnvironment.VERCEL_GIT_COMMIT_SHA
    process.env.NEXT_PUBLIC_BUILD_VERSION =
      originalEnvironment.NEXT_PUBLIC_BUILD_VERSION
  })

  function emittedEvents() {
    return [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls]
      .map(([entry]) => JSON.parse(String(entry))) as Array<
      Record<string, unknown>
    >
  }

  it("emits one safe start and success pair with the same opaque request id", () => {
    const trace = startCriticalOperation("opportunity.create")
    trace.success()

    const [start, success] = emittedEvents()
    expect(start).toEqual({
      event: "wave_critical_operation",
      schema_version: 1,
      operation: "opportunity.create",
      stage: "start",
      request_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      environment: "test",
      release: "dd65c28",
    })
    expect(success).toEqual({
      ...start,
      stage: "success",
      duration_ms: expect.any(Number),
    })
    expect(Number.isInteger(success.duration_ms)).toBe(true)
    expect(success.duration_ms).toBeGreaterThanOrEqual(0)
    expect(success.duration_ms).toBeLessThanOrEqual(600_000)
  })

  it("emits only a stable failure category and ignores later terminal calls", () => {
    const trace = startCriticalOperation("email.resend_webhook")
    trace.failure("signature_invalid")
    trace.success()

    const [start, failure] = emittedEvents()
    expect(emittedEvents()).toHaveLength(2)
    expect(failure).toEqual({
      ...start,
      stage: "failure",
      duration_ms: expect.any(Number),
      error_category: "signature_invalid",
    })
    expect(alertMocks.scheduleCriticalOperationAlert).toHaveBeenCalledWith({
      operation: "email.resend_webhook",
      error_category: "signature_invalid",
      environment: "test",
      release: "dd65c28",
    })
  })

  it("does not expose raw runtime values through release context", () => {
    process.env.VERCEL_GIT_COMMIT_SHA =
      "release-sha person@example.test opportunity-1234 https://signed.test"

    startCriticalOperation("portal.memo_download").failure("storage_failed")

    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("person@example.test")
    expect(serialized).not.toContain("opportunity-1234")
    expect(serialized).not.toContain("https://signed.test")
    expect(emittedEvents()[0].release).toBe("")
  })

  it("never lets a logging failure alter the business flow", () => {
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error("logging transport failed with person@example.test")
    })
    vi.mocked(console.error).mockImplementation(() => {
      throw new Error("logging transport failed with person@example.test")
    })

    expect(() => {
      const trace = startCriticalOperation("cron.abandoned_forms")
      trace.failure("internal_error")
    }).not.toThrow()
  })

  it("creates a fresh opaque request id for each operation", () => {
    startCriticalOperation("opportunity.update")
    startCriticalOperation("pursuit.journey_action")

    const starts = emittedEvents().filter((event) => event.stage === "start")
    expect(starts).toHaveLength(2)
    expect(starts[0].request_id).not.toBe(starts[1].request_id)
  })

  it("records a safe terminal failure and preserves a thrown dependency error", async () => {
    const rawError = new Error(
      "database exploded for person@example.test opportunity-private-1",
    )
    const trace = startCriticalOperation("opportunity.create")

    await expect(
      trace.failOnThrow(
        async () => Promise.reject(rawError),
        "persistence_failed",
      ),
    ).rejects.toBe(rawError)

    expect(emittedEvents()[1]).toMatchObject({
      operation: "opportunity.create",
      stage: "failure",
      error_category: "persistence_failed",
    })
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("database exploded")
    expect(serialized).not.toContain("person@example.test")
    expect(serialized).not.toContain("opportunity-private-1")
  })
})
