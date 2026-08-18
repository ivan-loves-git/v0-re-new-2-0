import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("W-103 Relationship Ledger seam", () => {
  const ledger = source("lib/data/ma-relationship-ledger.ts")
  const globalReader = source("lib/actions/ma-relationships.ts")
  const workspaceReader = source("lib/actions/ma-relationship-workspaces.ts")

  it("keeps the set-based office ledger behind one server-only interface", () => {
    expect(ledger).toContain('import "server-only"')
    expect(ledger).toContain("readMaRelationshipLedger")
    expect(ledger).toContain('from("ma_contact_office_affiliations")')
    expect(ledger).toContain('from("opportunities")')
    expect(ledger).toContain('from("ma_interactions")')
    expect(ledger).toContain('from("opportunity_matches")')
    expect(ledger).toContain('in("opportunity.source_office_id", officeIds)')
    expect(ledger).toContain("Promise.all")
  })

  it("makes both read projections consume the same ledger and indicators", () => {
    expect(globalReader).toContain("readMaRelationshipLedger")
    expect(workspaceReader).toContain("readMaRelationshipLedger")
    expect(globalReader).toContain("buildMaRelationshipIndicators")
    expect(workspaceReader).toContain("buildMaRelationshipIndicators")
    expect(workspaceReader).not.toContain("function buildIndicators")
    expect(globalReader).not.toContain('.from("ma_interactions")')
    expect(ledger).toContain('purpose === "timeline"')
    expect(ledger).toContain('purpose === "detail"')
    expect(ledger).toContain('purpose === "global"')
    expect(ledger).toMatch(/purpose === "global"\s*\? 250/)
  })
})
