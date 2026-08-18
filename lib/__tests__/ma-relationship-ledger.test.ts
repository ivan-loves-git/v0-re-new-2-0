import { describe, expect, it } from "vitest"
import { buildMaRelationshipIndicators } from "@/lib/ma-relationship-statistics"

const sharedLedgerFixture = {
  offices: [
    { id: "paris", firmId: "firm-a" },
    { id: "lyon", firmId: "firm-a" },
  ],
  affiliations: [
    {
      officeId: "paris",
      contactId: "shared-contact",
      isActive: true,
      endedAt: null,
      contactStatus: "active" as const,
    },
    {
      officeId: "lyon",
      contactId: "shared-contact",
      isActive: true,
      endedAt: null,
      contactStatus: "active" as const,
    },
    {
      officeId: "paris",
      contactId: "historic-contact",
      isActive: false,
      endedAt: "2026-01-15",
      contactStatus: "active" as const,
    },
  ],
  opportunities: [
    {
      id: "active-stale",
      officeId: "paris",
      status: "active" as const,
      dateAdded: "2026-01-01",
      dateAddedPrecision: "day" as const,
    },
    {
      id: "active-pursuit",
      officeId: "paris",
      status: "paused" as const,
      dateAdded: "2026-01-02",
      dateAddedPrecision: "day" as const,
    },
    {
      id: "closed-month",
      officeId: "lyon",
      status: "closed" as const,
      dateAdded: "2026-02-01",
      dateAddedPrecision: "month" as const,
    },
  ],
  activePursuitOpportunityIds: ["active-pursuit"],
}

describe("W-103 Relationship Indicators", () => {
  it("derives the same office-centred facts for global and firm projections", () => {
    const indicators = buildMaRelationshipIndicators(
      sharedLedgerFixture.offices,
      sharedLedgerFixture.affiliations,
      sharedLedgerFixture.opportunities,
      sharedLedgerFixture.activePursuitOpportunityIds,
      new Date("2026-04-02T12:00:00.000Z"),
    )

    expect(indicators.byOfficeId.get("paris")).toMatchObject({
      activeContactCount: 1,
      historicalAffiliationCount: 1,
      sourcedOpportunityCount: 2,
      openOpportunityCount: 2,
      candidateStaleCount: 1,
      closedOpportunityCount: 0,
      latestKnownAt: "2026-01-02",
      latestKnownAtPrecision: "day",
    })
    expect(indicators.byOfficeId.get("lyon")).toMatchObject({
      activeContactCount: 1,
      historicalAffiliationCount: 0,
      sourcedOpportunityCount: 1,
      openOpportunityCount: 0,
      candidateStaleCount: 0,
      closedOpportunityCount: 1,
      latestKnownAt: "2026-02-01",
      latestKnownAtPrecision: "month",
    })
    expect(indicators.byFirmId.get("firm-a")).toMatchObject({
      officeCount: 2,
      activeContactCount: 1,
      historicalAffiliationCount: 1,
      sourcedOpportunityCount: 3,
      openOpportunityCount: 2,
      candidateStaleCount: 1,
      closedOpportunityCount: 1,
      latestKnownAt: "2026-02-01",
      latestKnownAtPrecision: "month",
    })
  })
})
