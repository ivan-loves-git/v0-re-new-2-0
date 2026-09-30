import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  env: { CRON_SECRET: "fictional-cron-secret" as string | undefined },
  runner: vi.fn(),
  trace: { success: vi.fn(), failure: vi.fn() },
}))
vi.mock("@/lib/env", () => ({ env: m.env }))
vi.mock("@/lib/email/discovery-digest-delivery", () => ({ runDueDiscoveryDigests: m.runner }))
vi.mock("@/lib/observability/critical-operation", () => ({ startCriticalOperation: () => m.trace }))

import { GET } from "@/app/api/cron/discovery-digest/route"

describe("isolated discovery digest cron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.env.CRON_SECRET = "fictional-cron-secret"
    m.runner.mockResolvedValue({ materialized: 0, materializationReview: 0,
      windowBatchLimitReached: false, processed: 0, sent: 0, uncertain: 0, failed: 0,
      reviewRequired: 0, budgetDeferred: 0 })
  })

  it("rejects absent or wrong secret before any database or provider work", async () => {
    m.env.CRON_SECRET = undefined
    expect((await GET(new Request("https://example.test/api/cron/discovery-digest"))).status).toBe(401)
    m.env.CRON_SECRET = "fictional-cron-secret"
    expect((await GET(new Request("https://example.test/api/cron/discovery-digest", {
      headers: { authorization: "Bearer wrong" },
    }))).status).toBe(401)
    expect(m.runner).not.toHaveBeenCalled()
  })

  it("runs only this bounded daily family after exact authorization", async () => {
    const result = { materialized: 1, materializationReview: 1,
      windowBatchLimitReached: false, processed: 2, sent: 1, uncertain: 0, failed: 0,
      reviewRequired: 1, budgetDeferred: 0 }
    m.runner.mockResolvedValue(result)
    const response = await GET(new Request("https://example.test/api/cron/discovery-digest", {
      headers: { authorization: "Bearer fictional-cron-secret" },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(result)
    expect(m.runner).toHaveBeenCalledWith(4, 40_000)
    expect(m.trace.failure).toHaveBeenCalledWith("provider_pending")
  })
})
