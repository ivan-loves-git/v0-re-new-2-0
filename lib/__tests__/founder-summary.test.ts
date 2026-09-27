import { describe, expect, it } from "vitest"
import { buildFounderSummary, type FounderSummaryInput } from "../founder-summary"

const issue = (number: number, overrides: Partial<FounderSummaryInput["productChanges"][number]> = {}) => ({
  number, title: `Change ${number}`, url: `https://github.com/re-new-team/renew-governance/issues/${number}`,
  state: "OPEN" as const, projectStatus: "In Progress" as const, closedAt: null,
  endReason: null, reopenedAt: null, releaseProof: null, ...overrides,
})
const input = (): FounderSummaryInput => ({
  reportAt: "2026-09-27T14:00:00.000Z",
  githubVerifiedAt: "2026-09-27T13:58:00.000Z",
  audienceAuthorized: true,
  strategy: { status: "accepted", revision: "2026-08-30-initial-1", sourceUrl: "https://github.com/re-new-team/renew-governance/blob/main/strategy/registry.yaml", goalTitles: ["Run more active pursuits with the same operations team"] },
  productChanges: [
    issue(1, { state: "CLOSED", projectStatus: "Done", closedAt: "2026-09-26T10:00:00.000Z", releaseProof: { productionCommit: "a".repeat(40), verifiedAt: "2026-09-26T12:00:00.000Z", proofUrl: "https://github.com/re-new-team/renew-governance/issues/1#issuecomment-1" } }),
    issue(2, { state: "CLOSED", projectStatus: "Done", closedAt: null }),
    issue(3, { state: "CLOSED", projectStatus: "Cancelled / Superseded", endReason: "cancelled" }),
    issue(4, { state: "CLOSED", projectStatus: "Cancelled / Superseded", endReason: "superseded" }),
    issue(5, { state: "OPEN", reopenedAt: "2026-09-27T09:00:00.000Z", closedAt: "2026-09-25T09:00:00.000Z" }),
    issue(6),
  ],
  tickets: [
    { number: 10, parentNumber: 6, state: "CLOSED" },
    { number: 11, parentNumber: 6, state: "OPEN" },
    { number: 12, parentNumber: 1, state: "CLOSED" },
  ],
  decisions: [{ number: 20, title: "Scope choice", url: "https://github.com/re-new-team/renew-governance/issues/20", state: "Needs Ivan" }],
})

describe("on-request founder summary contract", () => {
  it("distinguishes verified release, closure, cancellation, supersession, reopened and partial work", () => {
    const result = buildFounderSummary(input())
    expect(result.productChangeCount).toBe(6)
    expect(result.outcomes.map((item) => item.status)).toEqual([
      "released", "closed_unreleased", "cancelled", "superseded", "reopened", "partial",
    ])
    expect(result.outcomes[1].closedAt).toBeNull()
    expect(result.outcomes[1].release).toBeNull()
    expect(result.outcomes[5].ticketProgress).toEqual({ closed: 1, open: 1 })
    expect(result.decisionsNeeded.map((item) => item.number)).toEqual([20])
    expect(result.strategy.goalTitles).toEqual(["Run more active pursuits with the same operations team"])
    expect(result.kpiActuals).toBe("not assessed from GitHub delivery status")
  })

  it("does not double count a Product Change because of Tickets", () => {
    const source = input()
    source.productChanges = [issue(1)]
    source.tickets = [{ number: 10, parentNumber: 1, state: "CLOSED" }, { number: 11, parentNumber: 1, state: "CLOSED" }]
    const result = buildFounderSummary(source)
    expect(result.productChangeCount).toBe(1)
    expect(result.ticketCount).toBe(2)
    expect(result.outcomes[0].status).toBe("in_progress")
  })

  it("rejects stale or unsupported source and release claims", () => {
    const source = input()
    source.audienceAuthorized = false
    expect(() => buildFounderSummary(source)).toThrow(/audience/)
    source.audienceAuthorized = true
    source.strategy.status = "proposed"
    expect(() => buildFounderSummary(source)).toThrow(/accepted/)
    source.strategy.status = "accepted"
    source.productChanges[0].releaseProof = { productionCommit: "not-a-sha", verifiedAt: "2026-09-26T12:00:00.000Z", proofUrl: "https://github.com/re-new-team/renew-governance/issues/1" }
    expect(() => buildFounderSummary(source)).toThrow(/release proof/)
  })
})
