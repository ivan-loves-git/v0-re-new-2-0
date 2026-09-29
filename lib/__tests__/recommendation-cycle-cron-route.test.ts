import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  env: { CRON_SECRET: "synthetic-cron-secret" as string | undefined },
  runner: vi.fn(),
  trace: { success: vi.fn(), failure: vi.fn() },
}))
vi.mock("@/lib/env", () => ({ env: mocks.env }))
vi.mock("@/lib/email/recommendation-cycle-delivery", () => ({
  runPendingRecommendationCycleNotifications: mocks.runner,
}))
vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: () => mocks.trace,
}))

import { GET } from "@/app/api/cron/recommendation-cycles/route"

describe("isolated recommendation-cycle cron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.env.CRON_SECRET = "synthetic-cron-secret"
    mocks.runner.mockResolvedValue({
      sent: 0, failed: 0, reviewRequired: 0, processed: 0, budgetDeferred: 0,
    })
  })

  it("fails closed when the secret is missing or the bearer token differs", async () => {
    mocks.env.CRON_SECRET = undefined
    const missing = await GET(new Request("https://example.test/api/cron/recommendation-cycles"))
    expect(missing.status).toBe(401)
    mocks.env.CRON_SECRET = "synthetic-cron-secret"
    const wrong = await GET(new Request("https://example.test/api/cron/recommendation-cycles", {
      headers: { authorization: "Bearer wrong" },
    }))
    expect(wrong.status).toBe(401)
    expect(mocks.runner).not.toHaveBeenCalled()
  })

  it("runs only the bounded new job with truthful review-required status", async () => {
    mocks.runner.mockResolvedValue({
      sent: 0, failed: 0, reviewRequired: 1, processed: 2, budgetDeferred: 0,
    })
    const response = await GET(new Request("https://example.test/api/cron/recommendation-cycles", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sent: 0, failed: 0, reviewRequired: 1, processed: 2, budgetDeferred: 0,
    })
    expect(mocks.runner).toHaveBeenCalledWith(4, 40_000)
    expect(mocks.trace.failure).toHaveBeenCalledWith("provider_pending")
  })
})
