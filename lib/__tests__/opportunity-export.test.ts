import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  OPPORTUNITY_EXPORT_HEADERS,
  opportunityExportRowsToCsv,
  toOpportunityExportRows,
} from "@/lib/utils/opportunity-export"
import type { OpportunityWorkSurfaceRecord } from "@/lib/types/opportunity"

const root = resolve(__dirname, "../..")
const source = (path: string) => readFileSync(resolve(root, path), "utf8")

function opportunity(): OpportunityWorkSurfaceRecord {
  return {
    id: "opportunity-1",
    reference: "REF-001",
    status: "active",
    repreneur_exposure: "staff_only",
    date_added: "2026-08-01",
    date_added_precision: "month",
    sector: "Services",
    location: "Île-de-France",
    revenue_meur: 4,
    ebitda_keur: 400,
    headcount: 25,
    teaser_summary: "Approved anonymized summary",
    internal_notes: "Internal only",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    source_office: { id: "office-1", name: "Paris", firm: { id: "firm-1", name: "Firm" } },
    office_contacts: [{
      opportunity_id: "opportunity-1",
      affiliation_id: "affiliation-1",
      is_primary: true,
      is_active: true,
      contact_name_snapshot: "Contact",
    }],
    matches: [{
      id: "match-1",
      opportunity_id: "opportunity-1",
      status: "active_pursuit",
      pursuit_stage: "loi",
      updated_at: "2026-08-01T00:00:00.000Z",
    }],
  }
}

describe("W-074 opportunity export", () => {
  it("uses the approved fields once per opportunity and preserves source-date precision", () => {
    const [row] = toOpportunityExportRows([opportunity()])
    expect(Object.keys(row)).toEqual(OPPORTUNITY_EXPORT_HEADERS)
    expect(row).toMatchObject({
      ref_mandat: "REF-001",
      pipeline_status: "Active",
      journey_stage: "LOI",
      date_added: "2026-08",
      calculated_margin: "10%",
      source_firm_contact: "Firm · Contact",
      tags: "",
    })
  })

  it("leaves a margin blank when the inputs cannot support a calculation", () => {
    const candidate = opportunity()
    candidate.revenue_meur = 0
    expect(toOpportunityExportRows([candidate])[0].calculated_margin).toBe("")
  })

  it("escapes delimiters, line breaks, quotes and spreadsheet formulas", () => {
    const csv = opportunityExportRowsToCsv([{
      ref_mandat: "=1+1",
      pipeline_status: "A,B",
      journey_stage: "line\nbreak",
      date_added: "",
      sector: 'say "hi"',
      region: "",
      revenue_eur_m: "",
      ebitda_eur_k: "",
      calculated_margin: "",
      headcount: "",
      anonymized_description: "",
      source_firm_contact: "",
      internal_notes: "",
      tags: "",
    }])
    expect(csv).toContain("'=1+1")
    expect(csv).toContain('"A,B"')
    expect(csv).toContain('"line\nbreak"')
    expect(csv).toContain('"say ""hi"""')
  })

  it("keeps the private export behind a staff-only Server Action and out of portal code", () => {
    const action = source("lib/actions/opportunity-export.ts")
    const portal = source("lib/actions/repreneur-opportunities.ts")
    expect(action).toContain('"use server"')
    expect(action.indexOf("await requireStaffAccess()")).toBeLessThan(
      action.indexOf("listOpportunityWorkSurfaceRecords()"),
    )
    expect(portal).not.toContain("listOpportunityExportRows")
  })
})
