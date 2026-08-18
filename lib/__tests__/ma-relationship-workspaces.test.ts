import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("W-086/W-087 relationship workspaces", () => {
  const actions = source("lib/actions/ma-relationship-workspaces.ts")
  const ledger = source("lib/data/ma-relationship-ledger.ts")
  const freshnessPolicy = source("lib/opportunity-freshness-policy.ts")
  const provenance = source("lib/ma-relationship-activity-provenance.ts")
  const detail = source(
    "components/opportunities/ma-relationship-workspace-detail.tsx",
  )
  const contactAction = source(
    "components/opportunities/ma-office-contact-action.tsx",
  )
  const officePage = source(
    "app/(dashboard)/opportunities/ma/offices/[officeId]/page.tsx",
  )
  const firmPage = source(
    "app/(dashboard)/opportunities/ma/firms/[firmId]/page.tsx",
  )

  it("keeps both routes staff-only and uses the canonical office relationship chain", () => {
    expect(actions).toContain("await requireStaffAccess()")
    expect(actions).toContain('from("ma_offices")')
    expect(actions).toContain('from("ma_firms")')
    expect(ledger).toContain('from("ma_contact_office_affiliations")')
    expect(ledger).toContain('from("ma_interactions")')
    expect(ledger).toContain('in("source_office_id", officeIds)')
    expect(actions).not.toContain('from("ma_sources")')
    expect(officePage).toContain("getMaOfficeWorkspace")
    expect(firmPage).toContain("getMaFirmWorkspace")
  })

  it("does not turn firm aggregates into firm-owned records", () => {
    expect(detail).toMatch(/derived\s+through its offices/)
    expect(actions).not.toContain('.from("ma_firms").insert')
    expect(actions).not.toContain('.from("ma_firms").update')
    expect(actions).not.toContain('.from("ma_offices").update')
    expect(detail).toContain(
      "Source opportunities remain attached to the operating office",
    )
  })

  it("reuses the existing candidate-stale rule while displaying open as active or paused", () => {
    expect(actions).toContain("isCandidateStaleOpportunity")
    expect(actions).toContain("buildMaRelationshipIndicators")
    expect(freshnessPolicy).toContain('"draft",')
    expect(freshnessPolicy).toContain('"active",')
    expect(freshnessPolicy).toContain('"paused",')
    expect(freshnessPolicy).toContain("STALE_OPPORTUNITY_DAYS = 90")
    expect(ledger).toContain('eq("status", "active_pursuit")')
    expect(actions).toContain("latestKnownOpportunityDate")
    expect(actions).toContain("updated_by")
    expect(detail).toContain("Actor ${updatedBy}")
    expect(detail).toContain("Candidate-stale")
    expect(detail).toContain("Open opportunities")
  })

  it("keeps empty states and uses the approved contact-affiliation service", () => {
    expect(detail).toContain("No contacts are linked to this workspace.")
    expect(detail).toContain("No opportunities are linked to this workspace.")
    expect(detail).toContain("No relationship activity recorded.")
    expect(contactAction).toContain("createMaOfficeContact")
    expect(contactAction).toContain("listMaCanonicalContactOptions")
    expect(contactAction).toContain("already-active office affiliation")
    expect(contactAction).not.toContain('.from("ma_contacts")')
  })

  it("shows office contact emails read-only without inventing an edit workflow", () => {
    expect(ledger).toContain(
      "contact:ma_contacts(id, display_name, email, status",
    )
    expect(detail).toContain('Email: {contact.email || "Email not recorded"}')
    expect(detail).toContain("includeHistorical ?")
    expect(detail).not.toContain("Edit contact")
  })

  it("carries the W-085 evidence boundary into both workspace activity views", () => {
    expect(ledger).toContain("provider_idempotency_key")
    expect(actions).toContain("activityProvenance")
    expect(detail).toContain("hasConfirmedProviderDelivery")
    expect(detail).toContain("System-recorded")
    expect(detail).toContain("delivery unconfirmed")
    expect(detail).toContain('timeZone: "Europe/Paris"')
    expect(provenance).toContain("providerMessageId")
  })
})
