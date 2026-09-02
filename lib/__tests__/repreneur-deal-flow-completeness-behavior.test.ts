import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  responses: new Map<string, Array<{ data: unknown; error: null }>>(),
  from: vi.fn(),
  rpc: vi.fn(),
  access: vi.fn(async () => ({
    user: { id: "qa-auth-user", email: "qa@example.invalid" },
    repreneurId: "repreneur-qa",
  })),
  queueEvent: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requirePortalAccess: mocks.access }))
vi.mock("@/lib/data/locked-opportunity-interest-state", () => ({
  listLockedOpportunityInterestStateByMatch: vi.fn(async () => new Map()),
}))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({ queueM2RepreneurEvent: mocks.queueEvent }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from.mockImplementation((table: string) => {
      const response = mocks.responses.get(table)?.shift()
      if (!response && !["geography_nodes", "repreneur_geography_targets"].includes(table)) {
        throw new Error(`Missing ${table} test response`)
      }
      const resolvedResponse = response ?? { data: [], error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "eq", "in", "neq", "order", "limit"]) {
        builder[method] = () => builder
      }
      builder.maybeSingle = () => Promise.resolve(resolvedResponse)
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(resolvedResponse).then(resolve, reject)
      return builder
    }),
    rpc: mocks.rpc.mockImplementation((name: string) => {
      const response = mocks.responses.get(`rpc:${name}`)?.shift()
      if (!response) throw new Error(`Missing ${name} RPC test response`)
      return Promise.resolve(response)
    }),
  }),
}))

import {
  getMyRepreneurOpportunity,
  listMyRepreneurDealFlow,
} from "@/lib/actions/repreneur-opportunities"

const incompleteProfile = {
  id: "repreneur-qa",
  is_demo: false,
  first_name: "QA",
  last_name: "Repreneur",
  email: "qa@example.invalid",
  who_score: null,
  when_score: 70,
  scoring_flags: [],
  q12_geo_zones: ["ile-de-france"],
  q13_target_sectors_v2: ["construction"],
  q14_deal_size: ["1-3M"],
  sector_preferences: [],
  target_location: [],
  target_acquisition_size: null,
  investment_capacity: null,
}

const completeProfile = {
  ...incompleteProfile,
  lifecycle_status: "client",
  repreneur_offers: [{
    status: "accepted",
    offer: { name: "Deal Flow", price: 5000 },
  }],
  who_score: 72,
  scoring_flags: ["service"],
  target_revenue_min_meur: 1,
  target_revenue_max_meur: 3,
}

const invitedProfileWithoutPaidOffer = {
  ...completeProfile,
  lifecycle_status: "qualified",
  repreneur_offers: [{
    status: "accepted",
    offer: { name: "Diagnostic Flash", price: 0 },
  }],
}

const opportunity = {
  id: "opportunity-auto",
  reference: "Re-New - IDF - QA",
  status: "active",
  is_demo: false,
  repreneur_exposure: "all_repreneurs",
  public_title: "Anonymous opportunity",
  teaser_summary: "Safe summary",
  description: null,
  sector: "Construction",
  activity: null,
  location: "Ile-de-France",
  revenue_meur: 2,
  ebitda_keur: null,
  headcount: 20,
  geography_node_id: null,
  headcount_range: "10-49",
  date_added: "2026-08-01",
  date_added_precision: "day",
  updated_at: "2026-08-15T00:00:00.000Z",
}

const staffMatch = {
  id: "match-staff",
  status: "proposed",
  decline_reason_categories: [],
  decline_reason_text: null,
  pursuit_stage: null,
  pursuit_stage_updated_at: null,
  nda_status: null,
  nda_updated_at: null,
  interest_expressed_at: null,
  interest_notification_sent_at: null,
  updated_at: "2026-08-15T00:00:00.000Z",
  opportunity: { ...opportunity, id: "opportunity-staff" },
}

function setResponses(entries: Record<string, Array<{ data: unknown; error: null }>>) {
  mocks.responses = new Map(Object.entries(entries))
}

describe("incomplete-thesis portal behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.responses = new Map()
  })

  it("keeps staff selections and neutral live inventory when the thesis is incomplete", async () => {
    setResponses({
      repreneurs: [{ data: incompleteProfile, error: null }],
      opportunity_matches: [
        { data: [staffMatch], error: null },
        { data: [], error: null },
      ],
      "rpc:w164_repreneur_live_inventory": [{ data: [opportunity], error: null }],
    })

    const result = await listMyRepreneurDealFlow("relevance")

    expect(result.automaticMatching.complete).toBe(false)
    expect(result.staffRecommended).toHaveLength(1)
    expect(result.staffRecommended[0]?.opportunity_id).toBe("opportunity-staff")
    expect(result.dealFlow.map((item) => item.opportunity_id)).toEqual(["opportunity-auto"])
    expect(result.dealFlow[0]?.relevance_grade).toBe("not_evaluated")
    expect(mocks.rpc).toHaveBeenCalledWith("w164_repreneur_live_inventory", {
      p_repreneur_id: "repreneur-qa",
      p_opportunity_id: null,
    })
  })

  it("keeps automatic matching available for a complete thesis", async () => {
    setResponses({
      repreneurs: [{ data: completeProfile, error: null }],
      opportunity_matches: [
        { data: [staffMatch], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      "rpc:w164_repreneur_live_inventory": [{ data: [opportunity], error: null }],
      geography_nodes: [{ data: [], error: null }],
      repreneur_geography_targets: [{ data: [], error: null }],
    })

    const result = await listMyRepreneurDealFlow("relevance")

    expect(result.automaticMatching.complete).toBe(true)
    expect(result.staffRecommended.map((item) => item.opportunity_id)).toEqual(["opportunity-staff"])
    expect(result.dealFlow.map((item) => item.opportunity_id)).toEqual(["opportunity-auto"])
    expect(mocks.rpc).toHaveBeenCalled()
  })

  it("keeps automatic deal flow available to an invited portal repreneur without a paid offer", async () => {
    setResponses({
      repreneurs: [{ data: invitedProfileWithoutPaidOffer, error: null }],
      opportunity_matches: [
        { data: [staffMatch], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      "rpc:w164_repreneur_live_inventory": [{ data: [opportunity], error: null }],
      geography_nodes: [{ data: [], error: null }],
      repreneur_geography_targets: [{ data: [], error: null }],
    })

    const result = await listMyRepreneurDealFlow("relevance")

    expect(result.automaticMatching.complete).toBe(true)
    expect(result.dealFlow.map((item) => item.opportunity_id)).toEqual(["opportunity-auto"])
  })

  it("projects each visible deal once into the approved four Deals buckets", async () => {
    const matches = [
      staffMatch,
      { ...staffMatch, id: "match-interested", status: "interested", opportunity: { ...opportunity, id: "opportunity-interested" } },
      { ...staffMatch, id: "match-active", status: "active_pursuit", opportunity: { ...opportunity, id: "opportunity-active" } },
      { ...staffMatch, id: "match-declined", status: "declined", opportunity: { ...opportunity, id: "opportunity-declined" } },
      { ...staffMatch, id: "match-dropped", status: "dropped", opportunity: { ...opportunity, id: "opportunity-dropped" } },
    ]
    setResponses({
      repreneurs: [{ data: completeProfile, error: null }],
      opportunity_matches: [
        { data: matches, error: null },
        { data: [], error: null },
      ],
      "rpc:w164_repreneur_live_inventory": [{ data: [{ ...opportunity, id: "opportunity-live" }, ...matches.map((match) => match.opportunity)], error: null }],
      geography_nodes: [{ data: [], error: null }],
      repreneur_geography_targets: [{ data: [], error: null }],
    })

    const result = await listMyRepreneurDealFlow("relevance")

    expect(result.deals.map((item) => [item.opportunity_id, item.deal_bucket])).toEqual([
      ["opportunity-staff", "recommended"],
      ["opportunity-interested", "in_progress"],
      ["opportunity-active", "in_progress"],
      ["opportunity-declined", "declined"],
      ["opportunity-dropped", "declined"],
      ["opportunity-live", "live"],
    ])
    expect(new Set(result.deals.map((item) => item.opportunity_id)).size).toBe(6)
    expect(result.deals).toHaveLength(6)
  })

  it("excludes DEMO-classified opportunities from staff recommendations and automatic deal flow", async () => {
    setResponses({
      repreneurs: [{ data: completeProfile, error: null }],
      opportunity_matches: [{
        data: [{
          ...staffMatch,
          opportunity: {
            ...staffMatch.opportunity,
            is_demo: true,
          },
        }],
        error: null,
      }],
      "rpc:w164_repreneur_live_inventory": [{
        data: [{
          ...opportunity,
          id: "opportunity-demo-auto",
          is_demo: true,
        }],
        error: null,
      }],
      geography_nodes: [{ data: [], error: null }],
      repreneur_geography_targets: [{ data: [], error: null }],
    })

    const result = await listMyRepreneurDealFlow("relevance")

    expect(result.staffRecommended).toEqual([])
    expect(result.dealFlow).toEqual([])
  })

  it("allows a direct lookup for an active same-namespace inventory deal", async () => {
    const opportunityId = "00000000-0000-4000-8000-000000000001"
    setResponses({
      repreneurs: [{ data: incompleteProfile, error: null }],
      opportunity_matches: [
        { data: null, error: null },
        { data: [], error: null },
      ],
      "rpc:w164_repreneur_live_inventory": [{ data: [{ ...opportunity, id: opportunityId }], error: null }],
    })

    await expect(getMyRepreneurOpportunity(opportunityId)).resolves.toMatchObject({
      opportunity_id: opportunityId,
      relevance_grade: "not_evaluated",
    })
    expect(mocks.queueEvent).toHaveBeenCalled()
  })

  it("blocks a cross-namespace direct deal lookup even when a query mock returns it", async () => {
    const opportunityId = "00000000-0000-4000-8000-000000000002"
    setResponses({
      repreneurs: [{ data: completeProfile, error: null }],
      opportunity_matches: [{ data: null, error: null }],
      "rpc:w164_repreneur_live_inventory": [{ data: [{ ...opportunity, id: opportunityId, is_demo: true }], error: null }],
    })

    await expect(getMyRepreneurOpportunity(opportunityId)).resolves.toBeNull()
    expect(mocks.queueEvent).not.toHaveBeenCalled()
  })
})
