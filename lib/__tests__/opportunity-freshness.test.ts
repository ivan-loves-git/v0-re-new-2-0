import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

import { getOpportunityFreshnessData } from "@/lib/actions/opportunity-freshness"

function freshnessClient(rows: unknown[]) {
  const opportunitiesSelect = vi.fn()
  const opportunityStatusFilter = vi.fn()
  const firstOrder = vi.fn()
  const secondOrder = vi.fn().mockResolvedValue({ data: rows, error: null })
  const activePursuitsSelect = vi.fn()
  const activePursuitsFilter = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  })

  opportunitiesSelect.mockReturnValue({ in: opportunityStatusFilter })
  opportunityStatusFilter.mockReturnValue({ order: firstOrder })
  firstOrder.mockReturnValue({ order: secondOrder })
  activePursuitsSelect.mockReturnValue({ eq: activePursuitsFilter })

  const from = vi.fn((table: string) => {
    if (table === "opportunities") return { select: opportunitiesSelect }
    if (table === "opportunity_matches") {
      return { select: activePursuitsSelect }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { from, opportunitiesSelect }
}

describe("opportunity freshness source context", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"))
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-001" } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("uses canonical firm and office context before the legacy source label", async () => {
    const { from, opportunitiesSelect } = freshnessClient([
      {
        id: "canonical-opportunity",
        reference: "OPP-CANONICAL",
        public_title: null,
        source_label: "Legacy label that must not win",
        source_office: {
          name: "Paris",
          firm: { name: "Atlas Advisory" },
        },
        location: null,
        sector: null,
        status: "active",
        date_added: "2026-01-01",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "legacy-opportunity",
        reference: "OPP-LEGACY",
        public_title: null,
        source_label: "Legacy advisory",
        source_office: null,
        location: null,
        sector: null,
        status: "paused",
        date_added: "2026-01-02",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])
    mocks.createAdminClient.mockReturnValue({ from })

    const data = await getOpportunityFreshnessData()

    expect(opportunitiesSelect).toHaveBeenCalledWith(
      expect.stringContaining(
        "source_office:ma_offices(name, firm:ma_firms(name))",
      ),
    )
    expect(data.staleOpportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "canonical-opportunity",
          sourceContextLabel: "Atlas Advisory · Paris",
        }),
        expect.objectContaining({
          id: "legacy-opportunity",
          sourceContextLabel: "Legacy advisory",
        }),
      ]),
    )
  })
})
