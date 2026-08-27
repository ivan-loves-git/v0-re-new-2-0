import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  from: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateOpportunityDashboardTags: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateOpportunityDashboardTags: mocks.revalidateOpportunityDashboardTags,
  revalidateRepreneurDashboardTags: mocks.revalidateRepreneurDashboardTags,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}))

import { refreshStoredRepreneurMatches } from "@/lib/repreneur-profile-refresh"

function tableBuilder(table: string) {
  let operation: "select" | "update" = "select"
  const builder: Record<string, unknown> = {}
  builder.select = () => {
    operation = "select"
    return builder
  }
  builder.update = (values: Record<string, unknown>) => {
    operation = "update"
    mocks.updates.push(values)
    return builder
  }
  for (const method of ["eq", "in"]) builder[method] = () => builder
  builder.maybeSingle = async () => {
    if (table !== "repreneurs") throw new Error(`Unexpected maybeSingle for ${table}`)
    return {
      data: {
        id: "repreneur-1",
        is_demo: false,
        q12_geo_zones: ["bretagne"],
        q13_target_sectors_v2: ["industry"],
        target_revenue_min_meur: 1.5,
        target_revenue_max_meur: 3,
        target_ebitda_margin_min_pct: 12,
        target_staff_size_min: 10,
        target_staff_size_max: 40,
      },
      error: null,
    }
  }
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => {
    let result: { data: unknown; error: null }
    if (operation === "update") {
      result = { data: null, error: null }
    } else if (table === "opportunity_matches") {
      result = {
        data: [{
          id: "match-1",
          opportunity_id: "opportunity-1",
          opportunity: {
            is_demo: false,
            sector: "industry",
            activity: "precision workshop",
            location: "Bretagne",
            revenue_meur: 2,
            ebitda_keur: 300,
            headcount: 24,
            geography_node_id: "bretagne",
          },
        }],
        error: null,
      }
    } else if (table === "geography_nodes") {
      result = {
        data: [
          { id: "fr", stable_key: "france", parent_id: null },
          { id: "west", stable_key: "fr-macro-west", parent_id: "fr" },
          { id: "bretagne", stable_key: "fr-region-bretagne", parent_id: "west" },
        ],
        error: null,
      }
    } else if (table === "repreneur_geography_targets") {
      result = {
        data: [{ repreneur_id: "repreneur-1", geography_node_id: "west" }],
        error: null,
      }
    } else {
      throw new Error(`Unexpected table ${table}`)
    }
    return Promise.resolve(result).then(resolve, reject)
  }
  return builder
}

describe("stored Matching v2 refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updates = []
    mocks.from.mockImplementation(tableBuilder)
  })

  it("updates only the platform snapshot and preserves staff-owned fields", async () => {
    await refreshStoredRepreneurMatches("repreneur-1")

    expect(mocks.updates).toEqual([{
      platform_recommendation: "strong_fit",
      platform_score: 100,
      platform_reasons: [
        "Sector or activity matches the repreneur target preference.",
        "Geography matches the canonical France hierarchy.",
        "Revenue is within the target range.",
        "EBITDA margin meets the minimum target.",
        "Headcount is within the target range.",
      ],
    }])
    expect(mocks.updates[0]).not.toHaveProperty("status")
    expect(mocks.updates[0]).not.toHaveProperty("human_recommendation")
    expect(mocks.updates[0]).not.toHaveProperty("human_notes")
  })
})
