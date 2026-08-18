import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  getMaFirmWorkspace,
  getMaOfficeWorkspace,
} from "@/lib/actions/ma-relationship-workspaces"

const officeId = "11111111-1111-4111-8111-111111111111"
const opportunityId = "22222222-2222-4222-8222-222222222222"

function workspaceClient(opportunities: Array<Record<string, unknown>>) {
  const pursuitOpportunityFilter = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  })
  const pursuitStatusFilter = vi.fn(() => ({ in: pursuitOpportunityFilter }))
  const pursuitSelect = vi.fn(() => ({ eq: pursuitStatusFilter }))

  const firmMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: "firm-1",
      name: "Atlas Advisory",
      status: "active",
      internal_notes: null,
      created_at: null,
      updated_at: null,
      updated_by: null,
      offices: [],
    },
    error: null,
  })
  const firmEq = vi.fn(() => ({ maybeSingle: firmMaybeSingle }))
  const firmSelect = vi.fn(() => ({ eq: firmEq }))

  const affiliationsOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const affiliationsIn = vi.fn(() => ({ order: affiliationsOrder }))
  const affiliationsSelect = vi.fn(() => ({ in: affiliationsIn }))

  const opportunitiesOrder = vi.fn().mockResolvedValue({
    data: opportunities,
    error: null,
  })
  const opportunitiesIn = vi.fn(() => ({ order: opportunitiesOrder }))
  const opportunitiesSelect = vi.fn(() => ({ in: opportunitiesIn }))

  const interactionsIn = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  })
  const interactionsSecondOrder = vi.fn(() => ({ in: interactionsIn }))
  const interactionsFirstOrder = vi.fn(() => ({
    order: interactionsSecondOrder,
  }))
  const interactionsSelect = vi.fn(() => ({ order: interactionsFirstOrder }))

  const officeMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: officeId,
      firm_id: "firm-1",
      name: "Paris",
      city: "Paris",
      status: "active",
      is_default: true,
      internal_notes: null,
      created_at: null,
      updated_at: null,
      updated_by: null,
      firm: { id: "firm-1", name: "Atlas Advisory" },
    },
    error: null,
  })
  const officeEq = vi.fn(() => ({ maybeSingle: officeMaybeSingle }))
  const officeSelect = vi.fn(() => ({ eq: officeEq }))

  const from = vi.fn((table: string) => {
    if (table === "ma_offices") return { select: officeSelect }
    if (table === "ma_firms") return { select: firmSelect }
    if (table === "ma_contact_office_affiliations") {
      return { select: affiliationsSelect }
    }
    if (table === "opportunities") return { select: opportunitiesSelect }
    if (table === "ma_interactions") return { select: interactionsSelect }
    if (table === "opportunity_matches") return { select: pursuitSelect }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { from, pursuitOpportunityFilter, pursuitSelect }
}

describe("M&A workspace active-pursuit scope", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
  })

  it("filters active pursuits through opportunities in the selected office workspace", async () => {
    const client = workspaceClient([
      {
        id: opportunityId,
        reference: "OPP-1",
        public_title: "Target",
        activity: null,
        status: "active",
        date_added: "2026-01-01",
        date_added_precision: "day",
        source_office_id: officeId,
      },
    ])
    mocks.createAdminClient.mockReturnValue({ from: client.from })

    await getMaOfficeWorkspace(officeId)

    expect(client.pursuitSelect).toHaveBeenCalledWith(
      "opportunity_id, opportunity:opportunities!inner(source_office_id)",
    )
    expect(client.pursuitOpportunityFilter).toHaveBeenCalledWith(
      "opportunity.source_office_id",
      [officeId],
    )
  })

  it("does not query active pursuits when a selected firm has no office scope", async () => {
    const client = workspaceClient([])
    mocks.createAdminClient.mockReturnValue({ from: client.from })

    const workspace = await getMaFirmWorkspace("firm-1")

    expect(workspace?.offices).toEqual([])
    expect(client.pursuitSelect).not.toHaveBeenCalled()
  })
})
