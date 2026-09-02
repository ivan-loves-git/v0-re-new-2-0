import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  requireStaffAccess: vi.fn(),
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
  listLockedOpportunityInterestStateByMatch: vi.fn(async () => new Map()),
}))

import {
  getStaffPortalPreviewOpportunity,
  listStaffPortalPreviewOpportunities,
  listStaffPortalPreviewOptions,
} from "@/lib/actions/repreneur-portal-preview"

function query(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> & PromiseLike<typeof result> = {
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  for (const method of ["select", "eq", "in", "order", "limit"] as const) {
    builder[method] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve({
    ...result,
    data: Array.isArray(result.data) ? result.data[0] ?? null : result.data,
  }))
  return builder
}

describe("Staff Portal Preview DEMO counts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
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
      if (["geography_nodes", "repreneur_geography_targets"].includes(table)) return query({ data: [], error: null })
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
          geography_node_id: null,
          headcount_range: "10-49",
          date_added: "2026-09-01",
          date_added_precision: "day",
          updated_at: "2026-09-01T12:00:00.000Z",
        }],
        error: null,
      })
    })
  })

  it("counts the canonical live inventory even when the repreneur owns no matches", async () => {
    const [option] = await listStaffPortalPreviewOptions()

    expect(option.visibleOpportunityCount).toBe(1)
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith("w164_repreneur_live_inventory", {
      p_repreneur_id: repreneurId,
      p_opportunity_id: null,
    })
  })

  it("shows canonical live inventory to a REAL preview with zero owned matches", async () => {
    const result = await listStaffPortalPreviewOpportunities(repreneurId)

    expect(result.opportunities).toHaveLength(1)
    expect(result.opportunities[0]).toMatchObject({
      opportunity_id: opportunityId,
      match_id: null,
      deal_bucket: "live",
    })
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
    })
  })
})
