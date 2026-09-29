import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  getSnapshot: vi.fn(),
}))
vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/ai/ledger", () => ({ getWaveAiDashboardSnapshot: mocks.getSnapshot }))

import ProductIntelligencePage from "@/app/(dashboard)/tools/product-intelligence/page"

describe("Ticket #231 protected product intelligence page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
    mocks.getSnapshot.mockResolvedValue({ state: "complete", days: 7,
      asOf: "2026-09-30T12:00:00Z", windowStart: "2026-09-23T12:00:00Z",
      metrics: { attempts: 0, successes: 0, failures: 0, pending: 0,
        successRate: null, recordedFollowThrough: 0, followThroughRate: null,
        recordedHelpfulFeedback: 0, recordedUnhelpfulFeedback: 0, totalCostUsd: 0,
        inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0,
        reasoningTokens: 0, medianLatencyMs: null, p95LatencyMs: null,
        eventCounts: {}, errorCounts: {}, featureCounts: {}, linkedEventCount: 0,
        lastSuccessfulAt: null, lastLedgerActivityAt: null } })
  })

  it("denies non-staff before any ledger read", async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error("denied"))
    await expect(ProductIntelligencePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("denied")
    expect(mocks.getSnapshot).not.toHaveBeenCalled()
  })

  it("shows honest Missing, fixed capture, empty N/A and no fabricated KPI", async () => {
    const html = renderToStaticMarkup(await ProductIntelligencePage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain("Product intelligence")
    expect(html).toContain("Missing")
    expect(html).toContain("authorized analytics source can be verified")
    expect(html).not.toContain("llm_skill:read")
    expect(html).toContain("Captured as of 2026-09-30T12:00:00Z")
    expect(html).toContain("N/A")
    expect(html).toContain("No production AI runs in this window")
    expect(html).toContain('href="/tools/product-intelligence?window=30"')
    expect(html).not.toMatch(/PostHog adoption rate|saved query ID|PRIVATE ACTOR/)
    expect(mocks.getSnapshot).toHaveBeenCalledWith(7)
  })

  it("selects the 30-day evidence cohort without changing roles or sources", async () => {
    await ProductIntelligencePage({ searchParams: Promise.resolve({ window: "30" }) })
    expect(mocks.getSnapshot).toHaveBeenCalledWith(30)
  })
})
