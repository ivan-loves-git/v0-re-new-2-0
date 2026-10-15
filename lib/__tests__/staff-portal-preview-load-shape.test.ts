import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The staff portal preview re-runs the whole Deal Flow projection on every
 * deal switch. Each query below is one database round trip, and from Vercel
 * to the database that costs tens of milliseconds, so the shape of the load
 * (how many round trips run one after another, and whether any are repeated)
 * decides how slow a click feels.
 */
const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, any>>>,
  timeline: [] as { name: string; start: number; end: number }[],
  clock: 0,
}))

function timed<T>(name: string, value: () => T): Promise<T> {
  const entry = { name, start: mocks.clock++, end: -1 }
  mocks.timeline.push(entry)
  return new Promise((resolve) => setImmediate(() => { entry.end = mocks.clock++; resolve(value()) }))
}

vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: vi.fn(async () => ({ role: "staff", user: { id: "staff-1", email: "staff@example.test" } })),
  requirePortalAccess: vi.fn(async () => { throw new Error("portal access is not used by the staff preview") }),
}))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({ queueM2RepreneurEvent: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: (table: string) => {
    let rows = [...(mocks.rows[table] ?? [])]
    const field = (row: Record<string, any>, name: string): any => name.split(".").reduce<any>((value, key) => value?.[key], row)
    const builder: any = {
      select: () => builder,
      eq: (name: string, value: unknown) => { rows = rows.filter((row) => field(row, name) === value); return builder },
      in: (name: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(field(row, name))); return builder },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => timed(table, () => ({ data: rows[0] ?? null, error: null })),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        timed(table, () => ({ data: rows, error: null })).then(resolve, reject),
    }
    return builder
  },
  rpc: (name: string, args: { p_repreneur_id?: string; p_opportunity_id?: string }) => timed(`rpc:${name}`, () => ({
    data: name === "w164_repreneur_live_inventory"
      ? (mocks.rows.opportunities ?? []).filter((row) => row.status === "active"
        && (!args.p_opportunity_id || row.id === args.p_opportunity_id))
      : [],
    error: null,
  })),
}) }))

import { listStaffPreviewRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"

const owner = "25600000-0000-4000-8000-000000000001"
const opportunityId = "25600000-0000-4000-8000-000000000021"
const matchId = "25600000-0000-4000-8000-000000000031"
const opportunity = {
  id: opportunityId, status: "active", is_demo: false, repreneur_exposure: "staff_only",
  public_title: "Anonymous opportunity", teaser_summary: "Approved public summary",
  description: "PRIVATE SOURCE TEXT", reference: "PRIVATE REFERENCE",
  geography_node_id: null, sector: "Construction", location: "France",
  revenue_meur: 3, ebitda_keur: 300, headcount: 20,
  updated_at: "2026-10-01T10:00:00Z",
}
const relationship = {
  id: matchId, repreneur_id: owner, opportunity_id: opportunityId, status: "proposed",
  pursuit_stage: null, pursuit_stage_updated_at: null, recommendation_expires_at: "2099-01-01T00:00:00Z",
  updated_at: "2026-10-01T10:00:00Z", opportunity, nda_status: null,
  interest_expressed_at: null, interest_notification_sent_at: null,
}

/** Longest chain of non-overlapping calls = serialized round trips on the critical path. */
function serializedStages() {
  return [...mocks.timeline].sort((a, b) => a.start - b.start).reduce((acc, entry) => {
    if (entry.start > acc.chainEnd) return { stages: acc.stages + 1, chainEnd: entry.end }
    return acc
  }, { stages: 0, chainEnd: -1 }).stages
}

describe("staff portal preview Deal Flow load shape", () => {
  beforeEach(() => {
    mocks.timeline = []
    mocks.clock = 0
    mocks.rows = {
      repreneurs: [{ id: owner, first_name: "Synthetic", last_name: "Owner", email: "owner@example.invalid", is_demo: false,
        q12_geo_zones: [], q13_target_sectors_v2: [], target_revenue_min_meur: 1, target_revenue_max_meur: 5 }],
      opportunities: [opportunity], opportunity_matches: [relationship],
      geography_nodes: [], repreneur_geography_targets: [], opportunity_interest_events: [],
    }
  })

  it("reads the geography hierarchy once per preview, including the selected deal's criteria comparison", async () => {
    const result = await listStaffPreviewRepreneurDealFlow(owner, "relevance", matchId)
    expect(result.deals.map((deal) => deal.match_id)).toEqual([matchId])
    expect(result.deals[0].criteria_comparison?.map((criterion) => criterion.key)).toEqual(["sector", "geography", "revenue", "ebitda", "margin", "team"])
    const geographyReads = mocks.timeline.filter((entry) => entry.name === "geography_nodes")
    expect(geographyReads, mocks.timeline.map((entry) => entry.name).join(" → ")).toHaveLength(1)
  })

  it("runs only genuinely dependent lookups one after another", async () => {
    await listStaffPreviewRepreneurDealFlow(owner, "relevance", matchId)
    const order = mocks.timeline.map((entry) => entry.name).join(" → ")
    // Stage 1: owner profile + geography. Stage 2: matches + live inventory.
    // Stage 3: active-pursuit owners + locked interest state. Stage 4: the two
    // interest-outcome lookups, which need stage 3's timestamps.
    expect(serializedStages(), `serialized stages: ${serializedStages()}; order: ${order}`).toBeLessThanOrEqual(4)
  })
})
