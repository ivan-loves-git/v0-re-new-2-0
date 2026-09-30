import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  requireStaffAccess: vi.fn(),
  interestStates: vi.fn(),
}))

const repreneurId = "00000000-0000-4000-8000-000000000001"
const opportunityId = "00000000-0000-4000-8000-000000000002"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))
vi.mock("@/lib/data/locked-opportunity-interest-state", () => ({
  listLockedOpportunityInterestStateByMatch: mocks.interestStates,
}))

import {
  getStaffPortalPreviewOpportunity,
  listStaffPortalPreviewOpportunities,
  listStaffPortalPreviewOwnedOpportunities,
  listStaffPortalPreviewOptions,
} from "@/lib/actions/repreneur-portal-preview"

function query(result: { data: unknown; error: null }, filterRows = false) {
  const predicates: ((row: unknown) => boolean)[] = []
  const valueAt = (row: unknown, column: string): unknown => column.split(".").reduce<unknown>((value, key) =>
    value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row)
  const selected = () => ({ ...result, data: filterRows && Array.isArray(result.data)
    ? result.data.filter((row) => predicates.every((predicate) => predicate(row))) : result.data })
  const builder: Record<string, unknown> & PromiseLike<typeof result> = {
    then(resolve, reject) {
      return Promise.resolve(selected()).then(resolve, reject)
    },
  }
  for (const method of ["select", "order", "limit"] as const) {
    builder[method] = vi.fn(() => builder)
  }
  builder.eq = vi.fn((column: string, value: unknown) => {
    predicates.push((row) => valueAt(row, column) === value)
    return builder
  })
  builder.in = vi.fn((column: string, values: unknown[]) => {
    predicates.push((row) => values.includes(valueAt(row, column)))
    return builder
  })
  builder.or = vi.fn((expression: string) => {
    const clauses = expression.split(",").map((clause) => clause.split(".eq."))
    predicates.push((row) => clauses.some(([column, value]) => valueAt(row, column) === value))
    return builder
  })
  builder.maybeSingle = vi.fn(() => {
    const read = selected()
    if (filterRows && Array.isArray(read.data) && read.data.length > 1) {
      return Promise.resolve({ data: null, error: { message: "Multiple matches returned" } })
    }
    return Promise.resolve({ ...read, data: Array.isArray(read.data) ? read.data[0] ?? null : read.data })
  })
  return builder
}

describe("Staff Portal Preview DEMO counts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
    mocks.interestStates.mockResolvedValue(new Map())
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return query({
        data: [{
          id: repreneurId,
          first_name: "QA",
          last_name: "Repreneur",
          email: "qa@example.invalid",
          lifecycle_status: "active",
          is_demo: false,
        }],
        error: null,
      })
      if (table === "app_user_roles") return query({ data: [], error: null })
      if (table === "opportunities") return query({
        data: [
          { id: opportunityId, is_demo: false, status: "active" },
          { id: "opportunity-demo", is_demo: true, status: "active" },
        ],
        error: null,
      })
      if (table === "opportunity_matches") return query({
        data: [],
        error: null,
      })
      if (table === "geography_nodes") return query({ data: [
        { id: "fr", stable_key: "france", label: "France", node_level: "country", parent_id: null },
        { id: "idf-macro", stable_key: "fr-macro-idf", label: "Île-de-France", node_level: "macro_zone", parent_id: "fr" },
        { id: "idf-region", stable_key: "fr-region-idf", label: "Île-de-France", node_level: "region", parent_id: "idf-macro" },
      ], error: null })
      if (table === "repreneur_geography_targets") return query({ data: [], error: null })
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.rpc.mockImplementation((name: string) => {
      if (name !== "w164_repreneur_live_inventory") throw new Error(`Unexpected RPC: ${name}`)
      return Promise.resolve({
        data: [{
          id: opportunityId,
          is_demo: false,
          reference: "Confidential opportunity",
          public_title: "Safe live opportunity",
          teaser_summary: "Safe teaser",
          sector: "Services aux entreprises (B2B)",
          activity: null,
          location: "Paris",
          revenue_meur: 2,
          ebitda_keur: 200,
          headcount: 20,
          geography_node_id: "idf-region",
          headcount_range: "10-49",
          date_added: "2026-09-01",
          date_added_precision: "day",
          updated_at: "2026-09-01T12:00:00.000Z",
        }],
        error: null,
      })
    })
  })

  it("does not advertise a namespace-wide count as one person's deal count", async () => {
    const [option] = await listStaffPortalPreviewOptions()

    expect(option.id).toBe(repreneurId)
    expect(option).not.toHaveProperty("visibleOpportunityCount")
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("does not confuse a shared email with a role linked to a different valid profile", async () => {
    const otherId = "00000000-0000-4000-8000-000000000099"
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return query({ data: [
        { id: repreneurId, first_name: "Ada", last_name: "One", email: "shared@example.test", lifecycle_status: "client", is_demo: false },
        { id: otherId, first_name: "Bea", last_name: "Two", email: "shared@example.test", lifecycle_status: "client", is_demo: false },
      ], error: null })
      if (table === "app_user_roles") return query({ data: [
        { role: "repreneur", email: "shared@example.test", repreneur_id: otherId },
      ], error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const options = await listStaffPortalPreviewOptions()
    expect(options[0].portalRoleLinked).toBe(false)
    expect(options[1].portalRoleLinked).toBe(true)
  })

  it("shows canonical live inventory to a REAL preview with zero owned matches", async () => {
    const result = await listStaffPortalPreviewOpportunities(repreneurId)

    expect(result.opportunities).toHaveLength(1)
    expect(result.opportunities[0]).toMatchObject({
      opportunity_id: opportunityId,
      match_id: null,
      deal_bucket: "live",
      geography_filter_nodes: [
        { id: "idf-macro", equivalentNodeIds: ["idf-region"] },
        { id: "fr" },
      ],
    })
    expect(result.opportunities[0]).not.toHaveProperty("geography_path_stable_keys")
    expect(mocks.rpc).toHaveBeenCalledWith("w164_repreneur_live_inventory", {
      p_repreneur_id: repreneurId,
      p_opportunity_id: null,
    })
  })

  it("opens an unmatched live deal by opportunity ID in the staff preview", async () => {
    await expect(getStaffPortalPreviewOpportunity(repreneurId, opportunityId)).resolves.toMatchObject({
      opportunity_id: opportunityId,
      match_id: null,
      deal_bucket: "live",
      criteria_comparison: [
        { key: "sector" }, { key: "geography" }, { key: "revenue" },
        { key: "ebitda" }, { key: "margin" }, { key: "team" },
      ],
    })
  })

  it.each([
    { isDemo: false, by: "opportunity" }, { isDemo: true, by: "opportunity" },
    { isDemo: false, by: "match" }, { isDemo: true, by: "match" },
  ])("retains the selected owner's current interest when opening its $by ID (DEMO=$isDemo)", async ({ isDemo, by }) => {
    const matchId = "00000000-0000-4000-8000-000000000003"
    const interestAt = "2026-09-30T14:00:00.000Z"
    const updatedAt = "2026-09-30T14:00:01.000Z"
    const originalFrom = mocks.from.getMockImplementation()!
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return query({ data: [{ id: repreneurId, is_demo: isDemo }], error: null })
      if (table === "opportunity_matches") return query({ data: [{
        id: "00000000-0000-4000-8000-000000000004", opportunity_id: opportunityId,
        repreneur_id: "00000000-0000-4000-8000-000000000099", status: "interested",
        updated_at: "2026-09-30T13:00:00.000Z", opportunity: {
          id: opportunityId, is_demo: isDemo, status: "active", public_title: "Another owner's interest",
        },
      }, {
        id: matchId, opportunity_id: opportunityId, repreneur_id: repreneurId,
        status: "interested", updated_at: updatedAt, opportunity: {
          id: opportunityId, is_demo: isDemo, status: "active", repreneur_exposure: "anonymized",
          public_title: "Current owned interest", sector: "Industrie", location: "France",
        },
      }], error: null }, true)
      if (table === "opportunity_interest_events") return query({ data: [], error: null })
      return originalFrom(table)
    })
    mocks.interestStates.mockResolvedValue(new Map([[matchId, {
      interest_expressed_at: interestAt, interest_notification_sent_at: null,
    }]]))
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "w173_repreneur_rejections") return { data: [], error: null }
      if (name === "w164_repreneur_live_inventory") return { data: [{ id: opportunityId, is_demo: isDemo,
        public_title: "Current owned interest", sector: "Industrie", location: "France", updated_at: updatedAt,
      }], error: null }
      throw new Error(`Unexpected RPC: ${name}`)
    })

    const detail = await getStaffPortalPreviewOpportunity(repreneurId, by === "match" ? matchId : opportunityId)
    expect(detail).toMatchObject({ opportunity_id: opportunityId, match_id: matchId,
      match_status: "interested", interest_expressed_at: interestAt, updated_at: updatedAt })
    expect(detail).not.toHaveProperty("personal_review")
  })

  it.each([
    { isDemo: false, opportunityDemo: true, status: "active", matchStatus: "interested" },
    { isDemo: false, opportunityDemo: false, status: "paused", matchStatus: "interested" },
    { isDemo: false, opportunityDemo: false, status: "active", matchStatus: "completed" },
  ])("does not resolve an owned opportunity outside its namespace or visible lifecycle (%j)", async ({ isDemo, opportunityDemo, status, matchStatus }) => {
    const originalFrom = mocks.from.getMockImplementation()!
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return query({ data: [{ id: repreneurId, is_demo: isDemo }], error: null })
      if (table === "opportunity_matches") return query({ data: [{
        id: "00000000-0000-4000-8000-000000000003", opportunity_id: opportunityId,
        repreneur_id: repreneurId, status: matchStatus, opportunity: {
          id: opportunityId, is_demo: opportunityDemo, status, public_title: "Not visible",
        },
      }], error: null }, true)
      return originalFrom(table)
    })
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    await expect(getStaffPortalPreviewOpportunity(repreneurId, opportunityId)).resolves.toBeNull()
  })

  it("rejects an ambiguous match/opportunity ID instead of choosing an arbitrary match", async () => {
    const originalFrom = mocks.from.getMockImplementation()!
    mocks.from.mockImplementation((table: string) => table === "opportunity_matches" ? query({ data: [
      { id: "00000000-0000-4000-8000-000000000003", opportunity_id: opportunityId,
        repreneur_id: repreneurId, status: "interested", opportunity: { id: opportunityId, is_demo: false, status: "active" } },
      { id: opportunityId, opportunity_id: "00000000-0000-4000-8000-000000000004",
        repreneur_id: repreneurId, status: "interested", opportunity: { id: "00000000-0000-4000-8000-000000000004", is_demo: false, status: "active" } },
    ], error: null }, true) : originalFrom(table))
    await expect(getStaffPortalPreviewOpportunity(repreneurId, opportunityId)).rejects.toThrow("Multiple matches returned")
  })

  it("does not open live inventory returned from another namespace", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: opportunityId, is_demo: true, public_title: "Wrong namespace" }], error: null })
    await expect(getStaffPortalPreviewOpportunity(repreneurId, opportunityId)).resolves.toBeNull()
  })

  it("keeps the owned-match view narrow and excludes a historical cross-namespace parent", async () => {
    const originalFrom = mocks.from.getMockImplementation()!
    mocks.from.mockImplementation((table: string) => {
      if (table === "opportunity_matches") return query({ data: [
        { id: "match-real", status: "dropped", updated_at: "2026-09-01", opportunity: {
          id: opportunityId, is_demo: false, status: "active", repreneur_exposure: "staff_only",
          public_title: "Owned historical deal", sector: "Industrie" } },
        { id: "match-demo", status: "proposed", opportunity: {
          id: "demo-opportunity", is_demo: true, status: "active", public_title: "Wrong namespace" } },
      ], error: null })
      if (table === "opportunity_interest_events") return query({ data: [], error: null })
      return originalFrom(table)
    })
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const source = await listStaffPortalPreviewOwnedOpportunities(repreneurId)
    expect(source.opportunities).toHaveLength(1)
    expect(source.opportunities[0]).toMatchObject({ match_id: "match-real", match_status: "dropped",
      public_title: "Owned historical deal", deal_bucket: "declined", canonical_sector: "Industrie manufacturière",
      visible_documents: [] })
    expect(source.opportunities[0]).not.toHaveProperty("personal_review")
    expect(mocks.rpc).not.toHaveBeenCalledWith("w164_repreneur_live_inventory", expect.anything())
  })

  it("denies staff-only reads before constructing a service client", async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error("staff denied"))
    await expect(listStaffPortalPreviewOwnedOpportunities(repreneurId)).rejects.toThrow("staff denied")
    await expect(getStaffPortalPreviewOpportunity(repreneurId, opportunityId)).rejects.toThrow("staff denied")
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

})
