import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ payloads: [] as Array<Record<string, unknown>> }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(async (_name: string, args: { payload: Record<string, unknown> }) => {
      state.payloads.push(args.payload)
      return { data: [{ generation_id: "123e4567-e89b-42d3-a456-426614174000", trace_id: "trace", started_at: "2026-08-30T00:00:00.000Z" }], error: null }
    }),
  })),
}))

import { startWaveAiRun } from "@/lib/ai/ledger"

const base = {
  actorUserId: "staff-user",
  feature: "pdr_screening" as const,
  workflow: "pdr_screening_preview",
  surface: "/strategic-pdr/requests",
}

beforeEach(() => { state.payloads = [] })

describe("WAVE AI ledger reasoning effort", () => {
  it("records the configured global maximum by default for existing callers", async () => {
    await startWaveAiRun(base)
    expect(state.payloads).toEqual([expect.objectContaining({ reasoning_effort: "max" })])
  })

  it("records an explicit PDR-scoped effort instead of the global default", async () => {
    await startWaveAiRun({ ...base, reasoningEffort: "low" })
    expect(state.payloads).toEqual([expect.objectContaining({ reasoning_effort: "low" })])
  })
})
