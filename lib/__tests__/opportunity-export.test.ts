import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listOpportunityWorkSurfaceRecords: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/actions/opportunities", () => ({
  listOpportunityWorkSurfaceRecords: mocks.listOpportunityWorkSurfaceRecords,
}))
import {
  OPPORTUNITY_EXPORT_HEADERS,
  opportunityExportRowsToCsv,
  toOpportunityExportRows,
} from "@/lib/utils/opportunity-export"
import type { OpportunityWorkSurfaceRecord } from "@/lib/types/opportunity"
import { listOpportunityExportRows } from "@/lib/actions/opportunity-export"
import { downloadOpportunityCsv } from "@/components/opportunities/opportunity-export-button"

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
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "qa-staff" } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the approved fields once per opportunity and preserves source-date precision", () => {
    const [row] = toOpportunityExportRows([opportunity()])
    expect(Object.keys(row)).toEqual(OPPORTUNITY_EXPORT_HEADERS)
    expect(row).toMatchObject({
      ref_mandat: "REF-001",
      pipeline_status: "LOI",
      date_added: "2026-08",
      calculated_margin: "10%",
      source_firm_contact: "Firm · Contact",
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
      date_added: "",
      sector: 'say "hi"',
      region: "",
      revenue_eur_m: "",
      ebitda_eur_k: "",
      calculated_margin: "",
      headcount: "",
      anonymized_description: "",
      source_firm_contact: "",
      internal_notes: "first line\nsecond,line",
    }])
    expect(csv).toContain("'=1+1")
    expect(csv).toContain('"A,B"')
    expect(csv).toContain('"say ""hi"""')
    expect(csv).toContain('"first line\nsecond,line"')
  })

  it("runs staff authorization before it reads export data", async () => {
    mocks.listOpportunityWorkSurfaceRecords.mockResolvedValue([opportunity()])

    await expect(listOpportunityExportRows()).resolves.toHaveLength(1)

    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.listOpportunityWorkSurfaceRecords).toHaveBeenCalledWith({
      includeSourceReview: false,
    })
  })

  it("does not load export data when staff authorization rejects the request", async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error("Staff access required"))

    await expect(listOpportunityExportRows()).rejects.toThrow("Staff access required")

    expect(mocks.listOpportunityWorkSurfaceRecords).not.toHaveBeenCalled()
  })

  it("preserves canonical and legacy historical primary-contact snapshots", () => {
    const canonical = opportunity()
    canonical.office_contacts = [{
      opportunity_id: canonical.id,
      affiliation_id: "inactive-affiliation",
      is_primary: true,
      is_active: false,
      contact_name_snapshot: "Historical canonical contact",
      affiliation: { id: "inactive-affiliation", office_id: "office-1", contact: null },
    }]
    const legacy = opportunity()
    legacy.source_office = null
    legacy.source = { id: "legacy-source", firm_name: "Legacy firm", source_type: "ma_firm", created_at: "2026-01-01", updated_at: "2026-01-01" }
    legacy.office_contacts = []
    legacy.source_contacts = [{
      opportunity_id: legacy.id,
      source_id: "legacy-source",
      contact_id: "legacy-contact",
      is_primary: true,
      contact_name_snapshot: "Historical legacy contact",
      created_at: "2026-01-01",
    }]

    expect(toOpportunityExportRows([canonical])[0].source_firm_contact).toBe(
      "Firm · Historical canonical contact",
    )
    expect(toOpportunityExportRows([legacy])[0].source_firm_contact).toBe(
      "Legacy firm · Historical legacy contact",
    )
  })

  it("does not export an unverified free-text source label", () => {
    const candidate = opportunity()
    candidate.source_office = null
    candidate.source = null
    candidate.source_label = "Unverified free text"
    candidate.office_contacts = []

    expect(toOpportunityExportRows([candidate])[0].source_firm_contact).toBe("")
  })

  it("does not combine a canonical firm with a legacy contact", () => {
    const candidate = opportunity()
    candidate.office_contacts = []
    candidate.source = {
      id: "legacy-source",
      firm_name: "Legacy firm",
      source_type: "ma_firm",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    }
    candidate.source_contacts = [{
      opportunity_id: candidate.id,
      source_id: "legacy-source",
      contact_id: "legacy-contact",
      is_primary: true,
      contact_name_snapshot: "Legacy contact",
      created_at: "2026-01-01",
    }]

    expect(toOpportunityExportRows([candidate])[0].source_firm_contact).toBe(
      "Firm",
    )
  })

  it("downloads a UTF-8 BOM and revokes the object URL in a later task", async () => {
    const click = vi.fn()
    const revokeObjectURL = vi.fn()
    const createObjectURL = vi.fn().mockReturnValue("blob:opportunity-export")
    const setTimeout = vi.fn((callback: () => void) => {
      expect(revokeObjectURL).not.toHaveBeenCalled()
      callback()
      return 1
    })
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue({ click, href: "", download: "" }),
    })
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })
    vi.stubGlobal("window", { setTimeout })

    downloadOpportunityCsv("ref_mandat\nOPP-001")

    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3))).toEqual([
      0xef,
      0xbb,
      0xbf,
    ])
    expect(click).toHaveBeenCalledOnce()
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:opportunity-export")
  })
})
