import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, any>>>,
  unavailableVisits: false,
  from: vi.fn(),
  rpc: vi.fn(),
  access: vi.fn(async () => ({
    user: { id: "qa-owner", email: "owner@example.invalid" },
    role: "repreneur", repreneurId: "25600000-0000-4000-8000-000000000001",
  })),
  staff: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({ requirePortalAccess: mocks.access, requireStaffAccess: mocks.staff }))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({ queueM2RepreneurEvent: vi.fn() }))
vi.mock("@/lib/data/locked-opportunity-interest-state", () => ({
  listLockedOpportunityInterestStateByMatch: vi.fn(async () => new Map()),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: mocks.from.mockImplementation((table: string) => {
    let rows = [...(mocks.rows[table] ?? [])]
    let maximum = Infinity
    const field = (row: Record<string, any>, name: string): any => name.split(".").reduce<any>((value, key) => value?.[key], row)
    const builder: any = {
      select: () => builder,
      eq: (name: string, value: unknown) => { rows = rows.filter(row => field(row, name) === value); return builder },
      in: (name: string, values: unknown[]) => { rows = rows.filter(row => values.includes(field(row, name))); return builder },
      gt: (name: string, value: string) => { rows = rows.filter(row => field(row, name) > value); return builder },
      order: (name: string, options?: { ascending?: boolean }) => { rows.sort((a, b) => String(field(a, name)).localeCompare(String(field(b, name))) * (options?.ascending === false ? -1 : 1)); return builder },
      limit: (limit: number) => { maximum = limit; return builder },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: rows.slice(0, maximum), error: table === "repreneur_opportunity_review_state" && mocks.unavailableVisits ? { message: "unavailable" } : null,
      }).then(resolve),
    }
    return builder
  }),
  rpc: mocks.rpc.mockImplementation(async (name: string, args: { p_opportunity_id?: string; p_repreneur_id?: string }) => ({
    data: name === "w164_repreneur_live_inventory"
      ? (mocks.rows.opportunities ?? []).filter(row => row.status === "active"
        && row.is_demo === mocks.rows.repreneurs.find(profile => profile.id === args.p_repreneur_id)?.is_demo
        && (!args.p_opportunity_id || row.id === args.p_opportunity_id))
      : [], error: null,
  })),
}) }))

import { getMyRepreneurOpportunity, listMyRepreneurDealFlow, listStaffPreviewRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"

const owner = "25600000-0000-4000-8000-000000000001"
const pausedId = "25600000-0000-4000-8000-000000000021"
const matchId = "25600000-0000-4000-8000-000000000031"
const paused = {
  id: pausedId, status: "paused", is_demo: false, repreneur_exposure: "staff_only",
  public_title: "Retained anonymous opportunity", teaser_summary: "Approved public summary",
  description: "PRIVATE SOURCE TEXT", source_office_id: "PRIVATE OFFICE",
  internal_notes: "PRIVATE PAUSE REASON", reference: "PRIVATE REFERENCE",
  geography_node_id: null, sector: "Construction", location: "France",
  updated_at: "2026-10-01T10:00:00Z",
}
const relationship = {
  id: matchId, repreneur_id: owner, opportunity_id: pausedId, status: "dropped",
  pursuit_stage: "dropped", pursuit_stage_updated_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T10:00:00Z", opportunity: paused,
  metadata: { private: "PRIVATE STAFF REASON" }, nda_status: "signed",
}

describe("authorized Paused history through owner and staff preview readers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.unavailableVisits = false
    delete process.env.PAUSED_OPPORTUNITY_HISTORY_DISABLED
    mocks.rows = {
      repreneurs: [{ id: owner, first_name: "Synthetic", last_name: "Owner", email: "owner@example.invalid", is_demo: false }],
      opportunities: [paused], opportunity_matches: [relationship], repreneur_opportunity_review_state: [],
    }
  })

  it("retains an authentic ended relationship in ordinary history without a new visit or active work", async () => {
    const result = await listMyRepreneurDealFlow("relevance")
    expect(result.deals).toHaveLength(1)
    expect(result.deals[0]).toMatchObject({
      opportunity_id: pausedId, match_id: matchId, match_status: "dropped",
      opportunity_status: "paused", pursuit_stage: "dropped", deal_bucket: "live", visible_documents: [],
    })
    expect(result.staffRecommended).toEqual([])
    expect(result.deals[0]).not.toHaveProperty("personal_review")
    expect(result.deals[0]).not.toHaveProperty("nda_status")
    expect(JSON.stringify(result.deals)).not.toContain("PRIVATE")
    expect(mocks.rpc.mock.calls.every(([name]) => name === "w164_repreneur_live_inventory" || name === "w173_repreneur_rejections")).toBe(true)
  })

  it("retains only genuine own same-mode openings without manufacturing a commercial relationship", async () => {
    mocks.rows.opportunity_matches = []
    mocks.rows.repreneur_opportunity_review_state = [
      { repreneur_id: owner, is_demo: false, opportunity_id: pausedId, opportunity: paused, reviewed: true, first_viewed_at: "PRIVATE FIRST VIEW" },
      { repreneur_id: "other-owner", is_demo: false, opportunity_id: "other", opportunity: { ...paused, id: "other" } },
      { repreneur_id: owner, is_demo: true, opportunity_id: "demo", opportunity: { ...paused, id: "demo", is_demo: true } },
      { repreneur_id: owner, is_demo: false, opportunity_id: "draft", opportunity: { ...paused, id: "draft", status: "draft" } },
    ]
    const before = structuredClone(mocks.rows)
    const result = await listMyRepreneurDealFlow("relevance")
    expect(result.deals).toHaveLength(1)
    expect(result.deals[0]).toMatchObject({ opportunity_id: pausedId, opportunity_status: "paused", match_id: null, match_status: null, deal_bucket: "live", visible_documents: [] })
    expect(result.deals[0]).not.toHaveProperty("pursuit_stage")
    expect(result.deals[0]).not.toHaveProperty("personal_review")
    expect(JSON.stringify(result.deals)).not.toContain("PRIVATE")
    expect(mocks.rows).toEqual(before)
  })

  it("deduplicates a relationship and genuine opening and resolves both real identities without writes", async () => {
    mocks.rows.repreneur_opportunity_review_state = [{ repreneur_id: owner, is_demo: false, opportunity_id: pausedId, opportunity: paused }]
    const before = structuredClone(mocks.rows)
    expect((await listMyRepreneurDealFlow("relevance")).deals).toHaveLength(1)
    expect(await getMyRepreneurOpportunity(matchId)).toMatchObject({ match_id: matchId, opportunity_status: "paused" })
    expect(await getMyRepreneurOpportunity(pausedId)).toMatchObject({ match_id: matchId, opportunity_status: "paused" })
    expect(mocks.rows).toEqual(before)
  })

  it("opens a genuine visit-only identity, but denies an unrelated, internal, draft or other-owner detail", async () => {
    mocks.rows.opportunity_matches = [{ ...relationship, status: "shortlisted" }]
    expect(await getMyRepreneurOpportunity(pausedId)).toBeNull()
    mocks.rows.repreneur_opportunity_review_state = [{ repreneur_id: owner, is_demo: false, opportunity_id: pausedId, opportunity: paused }]
    expect(await getMyRepreneurOpportunity(pausedId)).toMatchObject({ match_id: null, match_status: null, opportunity_status: "paused" })
    mocks.rows.repreneur_opportunity_review_state[0].repreneur_id = "other-owner"
    expect(await getMyRepreneurOpportunity(pausedId)).toBeNull()
    mocks.rows.repreneur_opportunity_review_state[0].repreneur_id = owner
    mocks.rows.repreneur_opportunity_review_state[0].opportunity = { ...paused, status: "draft" }
    expect(await getMyRepreneurOpportunity(pausedId)).toBeNull()
  })

  it("preview never queries private markers or exposes visit-only membership and counts", async () => {
    const visitedId = "25600000-0000-4000-8000-000000000022"
    mocks.rows.repreneur_opportunity_review_state = [{ repreneur_id: owner, is_demo: false, opportunity_id: visitedId, opportunity: { ...paused, id: visitedId } }]
    const result = await listStaffPreviewRepreneurDealFlow(owner)
    expect(result.deals.map(deal => deal.opportunity_id)).toEqual([pausedId])
    expect(result.deals[0]).toMatchObject({ match_id: matchId, match_status: "dropped", opportunity_status: "paused" })
    expect(result).not.toHaveProperty("pausedHistoryAvailability")
    expect(mocks.from.mock.calls.some(([table]) => table === "repreneur_opportunity_review_state")).toBe(false)
    expect(JSON.stringify(result)).not.toContain("PRIVATE")
    expect(result.deals[0]).not.toHaveProperty("personal_review")
  })

  it("represents missing private history as unavailable while preserving genuine relationships", async () => {
    mocks.unavailableVisits = true
    const result = await listMyRepreneurDealFlow("relevance")
    expect(result.pausedHistoryAvailability).toBe("unavailable")
    expect(result.deals.map(deal => deal.match_id)).toEqual([matchId])
    mocks.rows.opportunity_matches = []
    expect(await getMyRepreneurOpportunity(pausedId)).toBeNull()
  })

  it("retains completed eligible relationships but excludes unpublished and mixed-namespace matches", async () => {
    mocks.rows.opportunity_matches = [
      { ...relationship, status: "completed" },
      { ...relationship, id: "internal", status: "draft", opportunity: { ...paused, id: "internal" } },
      { ...relationship, id: "cross", opportunity: { ...paused, id: "cross", is_demo: true } },
      { ...relationship, id: "unpublished", opportunity: { ...paused, id: "unpublished", status: "draft" } },
    ]
    expect((await listMyRepreneurDealFlow("relevance")).deals.map(deal => deal.match_status)).toEqual(["completed"])
    expect((await listStaffPreviewRepreneurDealFlow(owner)).deals.map(deal => deal.match_status)).toEqual(["completed"])
    expect(await getMyRepreneurOpportunity(matchId)).toMatchObject({ match_id: matchId, match_status: "completed", opportunity_status: "paused" })
    const activeOpportunity = { ...paused, status: "active" }
    mocks.rows.opportunity_matches = [{ ...relationship, status: "completed", opportunity: activeOpportunity }]
    mocks.rows.opportunities = [activeOpportunity]
    expect((await listMyRepreneurDealFlow("relevance")).deals.map(deal => deal.match_id)).toEqual([null])
    expect((await listStaffPreviewRepreneurDealFlow(owner)).deals.map(deal => deal.match_id)).toEqual([null])
    expect(await getMyRepreneurOpportunity(matchId)).toBeNull()
    expect(await getMyRepreneurOpportunity(pausedId)).toMatchObject({ opportunity_id: pausedId, match_id: null, match_status: null })
  })

  it.each([false, true])("preserves exact owner and namespace detail/list eligibility when is_demo=%s", async (isDemo) => {
    const otherMatch = "25600000-0000-4000-8000-000000000041"
    const crossMatch = "25600000-0000-4000-8000-000000000042"
    const activeMatch = "25600000-0000-4000-8000-000000000043"
    const activeId = "25600000-0000-4000-8000-000000000044"
    const sameModePaused = { ...paused, is_demo: isDemo }
    const sameModeActive = { ...paused, id: activeId, status: "active", is_demo: isDemo }
    mocks.rows.repreneurs[0].is_demo = isDemo
    mocks.rows.opportunities = [sameModePaused, sameModeActive, { ...paused, id: "wrong-mode-live", status: "active", is_demo: !isDemo }]
    mocks.rows.opportunity_matches = [
      { ...relationship, opportunity: sameModePaused },
      { ...relationship, id: activeMatch, opportunity_id: activeId, status: "proposed", opportunity: sameModeActive },
      { ...relationship, id: otherMatch, repreneur_id: "other-owner", opportunity: sameModePaused },
      { ...relationship, id: crossMatch, opportunity: { ...paused, is_demo: !isDemo } },
    ]
    expect((await listMyRepreneurDealFlow("relevance")).deals.map(deal => deal.match_id).sort()).toEqual([matchId, activeMatch].sort())
    expect((await listStaffPreviewRepreneurDealFlow(owner)).deals.map(deal => deal.match_id).sort()).toEqual([matchId, activeMatch].sort())
    expect(await getMyRepreneurOpportunity(matchId)).toMatchObject({ match_id: matchId, opportunity_status: "paused" })
    expect(await getMyRepreneurOpportunity(activeMatch)).toMatchObject({ match_id: activeMatch, opportunity_status: "active" })
    expect(await getMyRepreneurOpportunity(otherMatch)).toBeNull()
    expect(await getMyRepreneurOpportunity(crossMatch)).toBeNull()
  })

  it("reads bounded pages without silently losing genuine owner history to a response cap", async () => {
    mocks.rows.opportunity_matches = []
    mocks.rows.repreneur_opportunity_review_state = Array.from({ length: 201 }, (_, index) => {
      const id = `25600000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`
      return { repreneur_id: owner, is_demo: false, opportunity_id: id, opportunity: { ...paused, id } }
    })
    const result = await listMyRepreneurDealFlow("relevance")
    expect(result.pausedHistoryAvailability).toBe("available")
    expect(result.deals).toHaveLength(201)
    expect(new Set(result.deals.map(deal => deal.opportunity_id)).size).toBe(201)
  })

  it("presentation disable hides history without querying or changing private markers", async () => {
    process.env.PAUSED_OPPORTUNITY_HISTORY_DISABLED = "1"
    const before = structuredClone(mocks.rows)
    const result = await listMyRepreneurDealFlow("relevance")
    expect(result.pausedHistoryAvailability).toBe("disabled")
    expect(result.deals).toEqual([])
    expect(await getMyRepreneurOpportunity(matchId)).toBeNull()
    expect(mocks.rows).toEqual(before)
    expect(mocks.from.mock.calls.some(([table]) => table === "repreneur_opportunity_review_state")).toBe(false)
  })

  it("presentation disable preserves Active relationships and their personal review state", async () => {
    process.env.PAUSED_OPPORTUNITY_HISTORY_DISABLED = "1"
    mocks.rows.opportunity_matches = [{ ...relationship, status: "proposed", opportunity: { ...paused, status: "active" } }]
    mocks.rows.repreneur_opportunity_review_state = [{ repreneur_id: owner, opportunity_id: pausedId, is_demo: false, reviewed: true }]
    const before = structuredClone(mocks.rows)
    const result = await listMyRepreneurDealFlow("relevance")
    expect(result.pausedHistoryAvailability).toBe("disabled")
    expect(result.deals[0]).toMatchObject({ opportunity_status: "active", match_id: matchId, personal_review: { viewed: true, reviewed: true } })
    expect(mocks.rows).toEqual(before)
  })
})
