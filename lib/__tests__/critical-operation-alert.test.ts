import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  isAlertableCriticalOperationFailure,
  scheduleCriticalOperationAlert,
  type CriticalOperationAlertScheduler,
} from "@/lib/observability/critical-operation-alert"

const database = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => database }))

describe("critical operation internal alerts", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    database.rpc.mockImplementation(async (name: string, args: Record<string, string>) => ({ error: null, data: name === "critical_alert_observe" ? {
      id: "synthetic-notification", lease_token: "synthetic-lease", idempotency_key: "wave-critical:synthetic-notification", kind: "opening",
      payload: { format_version: 1, operation: args.p_operation, error_category: args.p_category,
        environment: args.p_environment, release: args.p_release, from_email: args.p_from, recipient: args.p_recipient,
        first_failure_at: "2026-08-25T07:07:42.000Z", last_failure_at: "2026-08-25T07:07:42.000Z",
        notice_at: "2026-08-25T07:07:42.000Z", failure_count: 1 },
    } : true }))
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("alerts only for operational failures that need staff attention", () => {
    expect(isAlertableCriticalOperationFailure("internal_error")).toBe(true)
    expect(isAlertableCriticalOperationFailure("persistence_failed")).toBe(true)
    expect(isAlertableCriticalOperationFailure("provider_rejected")).toBe(true)
    expect(isAlertableCriticalOperationFailure("provider_unavailable")).toBe(true)
    expect(isAlertableCriticalOperationFailure("storage_failed")).toBe(true)

    expect(isAlertableCriticalOperationFailure("authorization_denied")).toBe(false)
    expect(isAlertableCriticalOperationFailure("not_found")).toBe(false)
    expect(isAlertableCriticalOperationFailure("precondition_failed")).toBe(false)
    expect(isAlertableCriticalOperationFailure("signature_invalid")).toBe(false)
    expect(isAlertableCriticalOperationFailure("validation_failed")).toBe(false)
  })

  it("schedules one content-free alert without blocking the failed action", async () => {
    const scheduled: Array<() => Promise<void>> = []
    const scheduler: CriticalOperationAlertScheduler = (task) => {
      scheduled.push(task)
    }
    const send = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null })

    expect(() =>
      scheduleCriticalOperationAlert(
        {
          operation: "opportunity.create",
          error_category: "persistence_failed",
          environment: "production",
          release: "2d76e5e",
        },
        {
          now: new Date("2026-08-25T07:07:42.000Z"),
          recipient: "alerts@example.test",
          schedule: scheduler,
          send,
        },
      ),
    ).not.toThrow()

    expect(scheduled).toHaveLength(1)
    await scheduled[0]()

    expect(send).toHaveBeenCalledOnce()
    const [message, options] = send.mock.calls[0]
    expect(message).toMatchObject({
      to: "alerts@example.test",
      subject: "[WAVE] Operational incident: opportunity.create",
    })
    expect(message.text).toContain("persistence_failed")
    expect(message.text).toContain("2026-08-25T07:07:42.000Z")
    expect(message.text).not.toContain("person@")
    expect(options).toEqual({
      idempotencyKey:
        "wave-critical:synthetic-notification",
    })
  })

  it("does not schedule alerts for expected product rejections or non-production", () => {
    const schedule = vi.fn()

    scheduleCriticalOperationAlert(
      {
        operation: "portal.memo_download",
        error_category: "authorization_denied",
        environment: "production",
        release: "2d76e5e",
      },
      { recipient: "alerts@example.test", schedule },
    )
    scheduleCriticalOperationAlert(
      {
        operation: "opportunity.create",
        error_category: "internal_error",
        environment: "preview",
        release: "2d76e5e",
      },
      { recipient: "alerts@example.test", schedule },
    )

    expect(schedule).not.toHaveBeenCalled()
  })

  it("contains scheduler and provider failures so alerting never changes product behavior", async () => {
    const schedulerError = new Error("scheduler contains person@example.test")
    const throwingScheduler: CriticalOperationAlertScheduler = () => {
      throw schedulerError
    }

    expect(() =>
      scheduleCriticalOperationAlert(
        {
          operation: "opportunity.update",
          error_category: "internal_error",
          environment: "production",
          release: "2d76e5e",
        },
        {
          recipient: "alerts@example.test",
          schedule: throwingScheduler,
        },
      ),
    ).not.toThrow()

    const scheduled: Array<() => Promise<void>> = []
    const send = vi.fn().mockRejectedValue(new Error("provider contains private data"))
    scheduleCriticalOperationAlert(
      {
        operation: "opportunity.update",
        error_category: "internal_error",
        environment: "production",
        release: "2d76e5e",
      },
      {
        recipient: "alerts@example.test",
        schedule: (task) => scheduled.push(task),
        send,
      },
    )

    await expect(scheduled[0]()).resolves.toBeUndefined()
    const serialized = vi
      .mocked(console.error)
      .mock.calls.map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("person@example.test")
    expect(serialized).not.toContain("private data")
  })
})
