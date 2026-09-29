import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { getWaveAiDashboardSnapshot } from "@/lib/ai/ledger"

const asOf = "2026-09-30T12:00:00.000Z"
const from7 = "2026-09-23T12:00:00.000Z"
const run = {
  generation_id: "00000000-0000-4000-8000-000000000001",
  feature: "email_draft", status: "succeeded", environment: "production", is_test: false,
  error_code: "", input_tokens: 100, cached_input_tokens: 10, cache_write_tokens: 0,
  output_tokens: 20, reasoning_tokens: 5, estimated_cost_usd: "0.00398725",
  latency_ms: 800, started_at: "2026-09-25T16:57:00.000Z",
  completed_at: "2026-09-25T16:58:00.000Z", initiated_by_user_id: "PRIVATE ACTOR",
}
const event = {
  generation_id: run.generation_id, event_type: "feedback_helpful",
  occurred_at: "2026-09-25T16:59:00.000Z", reason_code: "PRIVATE REASON",
}

function query(rows: unknown[], options: { count?: number | null; error?: unknown } = {}) {
  const calls: Array<[string, unknown[]]> = []
  const builder = {
    select(...args: unknown[]) { calls.push(["select", args]); return builder },
    eq(...args: unknown[]) { calls.push(["eq", args]); return builder },
    gte(...args: unknown[]) { calls.push(["gte", args]); return builder },
    lte(...args: unknown[]) { calls.push(["lte", args]); return builder },
    in(...args: unknown[]) { calls.push(["in", args]); return builder },
    order(...args: unknown[]) { calls.push(["order", args]); return builder },
    async range(from: number, through: number) {
      calls.push(["range", [from, through]])
      return { data: rows.slice(from, through + 1), count: options.count === undefined ? rows.length : options.count,
        error: options.error ?? null }
    },
  }
  return { builder, calls }
}

describe("Ticket #231 staff ledger reader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(asOf))
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff" } })
  })
  afterEach(() => vi.useRealTimers())

  it("denies a non-staff actor before constructing a service client", async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error("denied"))
    await expect(getWaveAiDashboardSnapshot(7)).rejects.toThrow("denied")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("withholds metrics when the service client cannot be constructed", async () => {
    mocks.createAdminClient.mockImplementation(() => { throw new Error("private configuration") })
    const snapshot = await getWaveAiDashboardSnapshot(7)
    expect(snapshot).toEqual({ state: "incomplete", reason: "read_failed",
      days: 7, asOf, windowStart: from7 })
    expect(JSON.stringify(snapshot)).not.toContain("private configuration")
  })

  it("reads exact production and linked event bounds, returning aggregate-only evidence", async () => {
    const runs = query([run])
    const events = query([event])
    const from = vi.fn((name: string) => name === "ai_generation_runs" ? runs.builder : events.builder)
    mocks.createAdminClient.mockReturnValue({ from })
    const snapshot = await getWaveAiDashboardSnapshot(7)

    expect(snapshot).toMatchObject({ state: "complete", days: 7, asOf, windowStart: from7,
      metrics: { attempts: 1, successes: 1, linkedEventCount: 1,
        recordedHelpfulFeedback: 1, totalCostUsd: 0.00398725 } })
    expect(runs.calls).toContainEqual(["eq", ["environment", "production"]])
    expect(runs.calls).toContainEqual(["eq", ["is_test", false]])
    expect(runs.calls).toContainEqual(["gte", ["started_at", from7]])
    expect(runs.calls).toContainEqual(["lte", ["started_at", asOf]])
    expect(runs.calls).toContainEqual(["range", [0, 499]])
    expect(events.calls).toContainEqual(["in", ["generation_id", [run.generation_id]]])
    expect(events.calls).toContainEqual(["gte", ["occurred_at", from7]])
    expect(events.calls).toContainEqual(["lte", ["occurred_at", asOf]])
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE ACTOR|PRIVATE REASON|00000000-0000-4000/)
  })

  it("withholds partial totals when the exact count is absent or exceeds the cap", async () => {
    const events = query([event])
    const noCount = query([run], { count: null })
    mocks.createAdminClient.mockReturnValue({ from: (name: string) =>
      name === "ai_generation_runs" ? noCount.builder : events.builder })
    const missing = await getWaveAiDashboardSnapshot(7)
    expect(missing).toEqual({ state: "incomplete", reason: "count_unavailable",
      days: 7, asOf, windowStart: from7 })
    expect(events.calls).toEqual([])

    const capped = query([], { count: 10_001 })
    mocks.createAdminClient.mockReturnValue({ from: () => capped.builder })
    const oversized = await getWaveAiDashboardSnapshot(7)
    expect(oversized).toMatchObject({ state: "incomplete", reason: "row_cap" })
    expect(JSON.stringify(oversized)).not.toContain("metrics")
  })

  it("withholds all metrics after a linked-event read error", async () => {
    const runs = query([run])
    const events = query([], { error: new Error("private diagnostic") })
    mocks.createAdminClient.mockReturnValue({ from: (name: string) =>
      name === "ai_generation_runs" ? runs.builder : events.builder })
    const snapshot = await getWaveAiDashboardSnapshot(7)
    expect(snapshot).toMatchObject({ state: "incomplete", reason: "read_failed" })
    expect(JSON.stringify(snapshot)).not.toMatch(/private diagnostic|generation_id|PRIVATE/)
  })

  it("rejects a run completed after the fixed capture time", async () => {
    const futureCompletion = query([{ ...run, completed_at: "2026-09-30T12:00:01Z" }])
    const events = query([])
    mocks.createAdminClient.mockReturnValue({ from: (name: string) =>
      name === "ai_generation_runs" ? futureCompletion.builder : events.builder })
    const snapshot = await getWaveAiDashboardSnapshot(7)
    expect(snapshot).toMatchObject({ state: "incomplete", reason: "invalid_row" })
    expect(events.calls).toEqual([])
  })
})
