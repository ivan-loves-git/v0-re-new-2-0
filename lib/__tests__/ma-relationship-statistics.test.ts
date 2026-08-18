import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildMaRelationshipStatistics } from "@/lib/ma-relationship-statistics"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-083 firm and office relationship statistics", () => {
  it("keeps office measures exact and deduplicates a shared contact at firm level", () => {
    const statistics = buildMaRelationshipStatistics(
      [
        { id: "paris", firmId: "firm-a" },
        { id: "lyon", firmId: "firm-a" },
      ],
      [
        {
          officeId: "paris",
          contactId: "contact-shared",
          isActive: true,
          endedAt: null,
          contactStatus: "active",
        },
        {
          officeId: "lyon",
          contactId: "contact-shared",
          isActive: true,
          endedAt: null,
          contactStatus: "active",
        },
        {
          officeId: "paris",
          contactId: "contact-archived",
          isActive: true,
          endedAt: null,
          contactStatus: "archived",
        },
      ],
      [
        {
          id: "open",
          officeId: "paris",
          status: "active",
          dateAdded: "2026-01-01",
        },
        {
          id: "paused",
          officeId: "paris",
          status: "paused",
          dateAdded: "2026-01-02",
        },
        {
          id: "closed",
          officeId: "lyon",
          status: "closed",
          dateAdded: "2026-01-03",
        },
        {
          id: "archived",
          officeId: "lyon",
          status: "archived",
          dateAdded: "2026-01-04",
          dateAddedPrecision: "month",
        },
      ],
      [],
      new Date("2026-04-02T00:00:00.000Z"),
    )

    expect(statistics.byOfficeId.get("paris")).toMatchObject({
      activeContactCount: 1,
      sourcedOpportunityCount: 2,
      openOpportunityCount: 2,
      candidateStaleCount: 2,
      latestKnownAt: "2026-01-02",
    })
    expect(statistics.byOfficeId.get("lyon")).toMatchObject({
      activeContactCount: 1,
      sourcedOpportunityCount: 1,
      openOpportunityCount: 0,
      candidateStaleCount: 0,
      latestKnownAt: "2026-01-04",
      latestKnownAtPrecision: "month",
    })
    expect(statistics.byFirmId.get("firm-a")).toMatchObject({
      officeCount: 2,
      activeContactCount: 1,
      sourcedOpportunityCount: 3,
      openOpportunityCount: 2,
      candidateStaleCount: 2,
      latestKnownAt: "2026-01-04",
      latestKnownAtPrecision: "month",
    })
  })

  it("uses the freshness rule: draft, active or paused at least 90 days old without an active pursuit", () => {
    const now = new Date("2026-05-01T00:00:00.000Z")
    const staleDate = "2026-01-30"
    const statistics = buildMaRelationshipStatistics(
      [{ id: "office-a", firmId: "firm-a" }],
      [],
      [
        {
          id: "draft-stale",
          officeId: "office-a",
          status: "draft",
          dateAdded: staleDate,
        },
        {
          id: "pursued-stale",
          officeId: "office-a",
          status: "active",
          dateAdded: staleDate,
        },
        {
          id: "closed-stale",
          officeId: "office-a",
          status: "closed",
          dateAdded: staleDate,
        },
      ],
      ["pursued-stale"],
      now,
    )

    expect(statistics.byOfficeId.get("office-a")?.candidateStaleCount).toBe(1)
  })

  it("projects canonical statuses and keeps expansion separate from detail navigation", () => {
    const actions = source("lib/actions/ma-relationships.ts")
    const ledger = source("lib/data/ma-relationship-ledger.ts")
    const workspace = source(
      "components/opportunities/ma-relationship-workspace.tsx",
    )

    expect(actions).toContain(
      'select("id, name, status, firm:ma_firms(id, name, status)")',
    )
    expect(actions).toContain("readMaRelationshipLedger")
    expect(ledger).toContain('eq("status", "active_pursuit")')
    expect(workspace).toContain("Open firm")
    expect(workspace).toContain("Open office")
    expect(workspace).toContain("Show offices")
    expect(workspace).toContain("Hide offices")
    expect(workspace).toContain("candidate-stale")
  })
})
