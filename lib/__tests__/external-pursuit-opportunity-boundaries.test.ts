import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  from: vi.fn(),
  listOpportunityWorkSurfaceRecords: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}))
vi.mock("@/lib/actions/opportunities", () => ({
  listOpportunityWorkSurfaceRecords: mocks.listOpportunityWorkSurfaceRecords,
}))

import { getOpportunityKpiData } from "@/lib/actions/opportunity-analytics"
import { listOpportunityExportRows } from "@/lib/actions/opportunity-export"

const canonicalOpportunity = {
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
  office_contacts: [],
  matches: [],
}

describe("W-110 opportunity boundary behavior", () => {
  const database = {
    opportunities: [{
      id: "opportunity-1",
      status: "active",
      source_id: null,
      source_label: null,
      source: null,
      source_office: { firm: { id: "firm-1" } },
    }],
    opportunity_matches: [{
      id: "match-1",
      status: "active_pursuit",
      pursuit_stage: "seller_meeting",
      nda_status: "required",
      reviewed_at: null,
    }],
    opportunity_documents: [{ id: "document-1", visibility: "approved_for_repreneur" }],
    // A realistic dossier is deliberately present in the fixture database.
    // Neither canonical opportunity reader is allowed to request this table.
    external_pursuits: [{
      id: "external-1",
      title: "Private external dossier",
      stage: "meetings",
      availability: "limited",
      owner_repreneur_id: "owner-1",
    }],
  } as Record<string, unknown[]>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "qa-staff" } })
    mocks.listOpportunityWorkSurfaceRecords.mockResolvedValue([canonicalOpportunity])
    mocks.from.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue({ data: database[table] ?? [], error: null }),
    }))
  })

  it("keeps actual KPI output unchanged when External Pursuit dossiers exist", async () => {
    const before = await getOpportunityKpiData()
    database.external_pursuits.push({
      id: "external-2",
      title: "Another private dossier",
      stage: "negotiation",
      availability: "unavailable",
      owner_repreneur_id: "owner-2",
    })
    const after = await getOpportunityKpiData()

    expect(after).toEqual(before)
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "opportunities", "opportunity_matches", "opportunity_documents",
      "opportunities", "opportunity_matches", "opportunity_documents",
    ])
    expect(mocks.from).not.toHaveBeenCalledWith("external_pursuits")
  })

  it("keeps actual export rows unchanged when External Pursuit dossiers exist", async () => {
    const before = await listOpportunityExportRows()
    database.external_pursuits.push({
      id: "external-3",
      title: "No export row",
      stage: "information",
      availability: "unknown",
      owner_repreneur_id: "owner-3",
    })
    const after = await listOpportunityExportRows()

    expect(after).toEqual(before)
    expect(after).toHaveLength(1)
    expect(mocks.listOpportunityWorkSurfaceRecords).toHaveBeenNthCalledWith(1, { includeSourceReview: false })
    expect(mocks.listOpportunityWorkSurfaceRecords).toHaveBeenNthCalledWith(2, { includeSourceReview: false })
    expect(mocks.from).not.toHaveBeenCalledWith("external_pursuits")
  })
})
