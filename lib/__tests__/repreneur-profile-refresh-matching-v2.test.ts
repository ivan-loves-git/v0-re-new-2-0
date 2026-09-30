import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_SECRET: "fictional-local-signing-secret-for-tests" } }))

import {
  refreshStoredRepreneurMatchesWithClient,
  refreshStoredOpportunityMatchesWithClient,
  refreshStoredMatchWithClient,
} from "@/lib/repreneur-match-refresh-core"
import { freshnessFromSnapshot, getSnapshotScoringInputs, signMatchInputs } from "@/lib/match-score-provenance"
import { captureOpportunityFitSource, captureRepreneurFitSource, fitSourceChanged } from "@/lib/match-source-change"
import { withStaffFitFreshness } from "@/lib/staff-fit-freshness"
import { calculateOpportunityMatchScore, matchingEffectiveInputs } from "@/lib/utils/opportunity-match-scoring"

function sourceSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    match: {
      id: "match-1", repreneur_id: "owner-1", opportunity_id: "deal-1",
      revision: 0, platform_score: null, platform_recommendation: "not_evaluated", platform_reasons: [],
    },
    repreneur: {
      is_demo: false, revision: 0, target_revision: 0,
      q12_geo_zones: ["bretagne"], q13_target_sectors_v2: ["Industrie manufacturière"],
      sector_preferences: ["technology"], target_location: ["all-france"],
      target_revenue_min_meur: 1.5, target_revenue_max_meur: 3,
      target_ebitda_margin_min_pct: 12, target_staff_size_min: 10, target_staff_size_max: 40,
    },
    opportunity: {
      is_demo: false, revision: 0, sector: "Industrie manufacturière", activity: "precision workshop",
      location: "Bretagne", revenue_meur: 2, ebitda_keur: 300,
      headcount: 24, geography_node_id: "br",
    },
    target_node_ids: ["br"],
    geography_nodes: [
      { id: "fr", stable_key: "france", parent_id: null },
      { id: "br", stable_key: "fr-region-brittany", parent_id: "fr" },
    ],
    taxonomy_revision: 0,
    provenance: null,
    ...overrides,
  }
}

function clientFor(snapshots: Array<Record<string, unknown>>, outcomes: string[], ids = ["match-1"]) {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = []
  const from = vi.fn((table: string) => {
    if (table !== "opportunity_matches") throw new Error("Separate source reads are forbidden")
    let after: string | null = null
    let limit = 50
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: (value: number) => { limit = value; return builder },
      gt: (_key: string, value: string) => { after = value; return builder },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve({
          data: ids.filter((id) => !after || id > after).slice(0, limit).map((id) => ({ id })),
          error: null,
        }).then(resolve, reject),
    }
    return builder
  })
  let readIndex = 0
  let commitIndex = 0
  const rpc = vi.fn(async (functionName: string, args: Record<string, unknown>) => {
    calls.push({ functionName, args })
    if (functionName === "match_score_source_snapshot") {
      const snapshot = snapshots[Math.min(readIndex++, snapshots.length - 1)]
      return { data: { ...snapshot, match: { ...(snapshot.match as Record<string, unknown>), id: args.p_match_id } }, error: null }
    }
    if (functionName === "match_score_commit_guarded") {
      return { data: outcomes[Math.min(commitIndex++, outcomes.length - 1)], error: null }
    }
    throw new Error("Unexpected RPC")
  })
  return { client: { from, rpc } as never, calls, from, rpc }
}

function sourceClientFor(table: string, rows: Array<Record<string, unknown>>) {
  let index = 0
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: rows[Math.min(index++, rows.length - 1)], error: null }),
  }
  return { from: vi.fn((name: string) => {
    if (name !== table) throw new Error("Unexpected source table")
    return builder
  }) } as never
}

describe("guarded stored Matching 2.2", () => {
  beforeEach(() => vi.clearAllMocks())

  it("never decorates an older list Fit with a newer snapshot's Fresh label", async () => {
    const beforeCommit = sourceSnapshot()
    const current = {
      ...beforeCommit,
      match: { ...beforeCommit.match, platform_score: 94, platform_recommendation: "strong_fit", platform_reasons: ["Current fictional reason"] },
      provenance: {
        platform_scoring_version: "2.2-gaussian-2026-09-11",
        platform_inputs_hmac: signMatchInputs(beforeCommit),
        platform_scored_at: "2026-09-30T00:00:00Z",
      },
    }
    // A guarded commit happened after this older staff-list SELECT.
    const oldListRow = {
      id: "match-1", platform_score: 60, platform_recommendation: "weak_fit" as const,
      platform_reasons: ["Old fictional reason"], human_notes: "unchanged human context",
    }
    const fake = clientFor([current], [])
    const [displayed] = await withStaffFitFreshness(fake.client, [oldListRow])
    expect(displayed).toMatchObject({
      platform_score: 94, platform_recommendation: "strong_fit",
      platform_reasons: ["Current fictional reason"], platform_freshness: "Fresh",
      human_notes: "unchanged human context",
    })
    expect(fake.calls.map((call) => call.functionName)).toEqual(["match_score_source_snapshot"])
  })

  it("gates unrelated profile edits and shadowed aliases before historical Unknown rows", async () => {
    const first = sourceSnapshot().repreneur
    const client = sourceClientFor("repreneurs", [
      first,
      { ...first, sector_preferences: ["different legacy"], target_location: ["all-france"] },
      { ...first, q13_target_sectors_v2: ["Tech & Digital"] },
    ])
    const before = await captureRepreneurFitSource(client, "owner-1")
    const shadowed = await captureRepreneurFitSource(client, "owner-1")
    const relevant = await captureRepreneurFitSource(client, "owner-1")
    expect(fitSourceChanged(before, shadowed)).toBe(false)
    expect(fitSourceChanged(before, relevant)).toBe(true)
  })

  it("skips an old Unknown match when changed opportunity evidence is untargeted for that buyer", async () => {
    const base = sourceSnapshot()
    const repreneur = { ...base.repreneur,
      target_revenue_min_meur: null, target_revenue_max_meur: null,
      target_ebitda_margin_min_pct: null,
    }
    const current = { ...base, repreneur, opportunity: { ...base.opportunity, revenue_meur: 3 } }
    const fake = clientFor([current], ["committed"])
    const previousOpportunity = {
      ...base.opportunity, sector: base.opportunity.sector, activity: base.opportunity.activity,
      revenue_meur: 2, ebitda_keur: base.opportunity.ebitda_keur,
      headcount: base.opportunity.headcount, location: base.opportunity.location,
    }
    const result = await refreshStoredOpportunityMatchesWithClient(fake.client, "deal-1", { previousOpportunity })
    expect(result).toMatchObject({ matchedRows: 1, notRelevantRows: 1, refreshedRows: 0 })
    expect(fake.calls.map((call) => call.functionName)).toEqual(["match_score_source_snapshot"])

    const sourceClient = sourceClientFor("opportunities", [
      { ...base.opportunity, is_demo: false },
      { ...base.opportunity, is_demo: false, location: "Changed but canonical geography shadows text" },
      { ...base.opportunity, is_demo: false, revenue_meur: 3 },
    ])
    const before = await captureOpportunityFitSource(sourceClient, "deal-1")
    const shadowed = await captureOpportunityFitSource(sourceClient, "deal-1")
    const relevant = await captureOpportunityFitSource(sourceClient, "deal-1")
    expect(fitSourceChanged(before, shadowed)).toBe(false)
    expect(fitSourceChanged(before, relevant)).toBe(true)
  })

  it("scores one cohesive source snapshot and sends only platform fields to the guarded commit", async () => {
    const fake = clientFor([sourceSnapshot()], ["committed"])
    const result = await refreshStoredRepreneurMatchesWithClient(fake.client, "owner-1")
    const commit = fake.calls.find((call) => call.functionName === "match_score_commit_guarded")?.args

    expect(result).toMatchObject({ matchedRows: 1, refreshedRows: 1, currentRows: 0, driftSkippedRows: 0, incomplete: false })
    expect(fake.from).toHaveBeenCalledTimes(1)
    expect(commit).toMatchObject({
      p_match_id: "match-1", p_repreneur_revision: 0, p_opportunity_revision: 0,
      p_match_revision: 0, p_target_revision: 0, p_taxonomy_revision: 0,
      p_scoring_version: "2.2-gaussian-2026-09-11", p_score: 100,
      p_recommendation: "strong_fit",
    })
    expect(commit?.p_reasons).toEqual([
      "Sector or activity matches the repreneur target preference.",
      "Geography matches the canonical France hierarchy.",
      "Revenue is within the target range.",
      "Absolute EBITDA is not targeted by this repreneur.",
      "EBITDA margin meets the target.",
      "Headcount is within the target range.",
    ])
    expect(commit?.p_inputs_hmac).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(commit)).not.toMatch(/human_notes|email|first_name|last_name|target_location/)
  })

  it("reloads after one CAS conflict and never submits an older score as current", async () => {
    const newer = sourceSnapshot({
      repreneur: { ...sourceSnapshot().repreneur, revision: 1, q13_target_sectors_v2: ["Tech & Digital"] },
    })
    const fake = clientFor([sourceSnapshot(), newer], ["conflict", "committed"])
    const result = await refreshStoredMatchWithClient(fake.client, "match-1")
    const commits = fake.calls.filter((call) => call.functionName === "match_score_commit_guarded")

    expect(result).toBe("refreshed")
    expect(commits).toHaveLength(2)
    expect(commits[0].args.p_repreneur_revision).toBe(0)
    expect(commits[1].args.p_repreneur_revision).toBe(1)
    expect(commits[1].args.p_inputs_hmac).not.toBe(commits[0].args.p_inputs_hmac)
  })

  it("stops after one retry and rejects cross-namespace history", async () => {
    const contested = clientFor([sourceSnapshot()], ["conflict", "conflict"])
    expect(await refreshStoredMatchWithClient(contested.client, "match-1")).toBe("drift")
    expect(contested.rpc).toHaveBeenCalledTimes(4)

    const crossNamespace = sourceSnapshot({
      opportunity: { ...sourceSnapshot().opportunity, is_demo: true },
    })
    const foreign = clientFor([crossNamespace], ["committed"])
    expect(await refreshStoredMatchWithClient(foreign.client, "match-1")).toBe("drift")
    expect(foreign.calls).toHaveLength(1)
  })

  it("uses stable bounded keyset pages and reports partial outcomes distinctly", async () => {
    const ids = Array.from({ length: 55 }, (_, index) => `match-${String(index).padStart(3, "0")}`)
    const fake = clientFor([sourceSnapshot()], ["committed"], ids)
    const result = await refreshStoredRepreneurMatchesWithClient(fake.client, "owner-1")
    expect(result).toMatchObject({ matchedRows: 55, refreshedRows: 55, incomplete: false })
    expect(fake.from).toHaveBeenCalledTimes(2)
    expect(fake.calls.filter((call) => call.functionName === "match_score_commit_guarded")).toHaveLength(55)

    const failed = clientFor([sourceSnapshot()], ["conflict"], ["match-001", "match-002"])
    const failedResult = await refreshStoredRepreneurMatchesWithClient(failed.client, "owner-1")
    expect(failedResult).toMatchObject({ matchedRows: 2, driftSkippedRows: 2, refreshedRows: 0 })
    expect(failedResult.failedMatchRows).toHaveLength(0)
  })

  it("recognizes legacy, current and changed signed inputs without writing", () => {
    const base = sourceSnapshot()
    expect(freshnessFromSnapshot(base)).toBe("Unknown")
    const signed = { ...base, provenance: {
      platform_scoring_version: "2.2-gaussian-2026-09-11",
      platform_inputs_hmac: signMatchInputs(base),
      platform_scored_at: "2026-09-30T00:00:00Z",
    } }
    expect(freshnessFromSnapshot(signed)).toBe("Fresh")
    expect(freshnessFromSnapshot({
      ...signed, opportunity: { ...signed.opportunity, revenue_meur: 4 },
    })).toBe("Stale")
    expect(freshnessFromSnapshot({ ...signed, provenance: null })).toBe("Unknown")
  })

  it("normalizes shadowed aliases, untargeted evidence and list order while retaining exact scorer output", () => {
    const base = sourceSnapshot()
    const first = matchingEffectiveInputs(base.repreneur, base.opportunity)
    const same = matchingEffectiveInputs({
      ...base.repreneur,
      sector_preferences: ["different legacy"],
      target_location: ["different legacy"],
      q13_target_sectors_v2: ["Industrie manufacturière", "Industrie manufacturière"],
    }, { ...base.opportunity, headcount: 24 })
    expect(same).toEqual(first)

    const noNumericTargets = {
      ...base.repreneur,
      target_revenue_min_meur: null, target_revenue_max_meur: null,
      target_ebitda_margin_min_pct: null, target_staff_size_min: null, target_staff_size_max: null,
    }
    expect(matchingEffectiveInputs(noNumericTargets, { ...base.opportunity, revenue_meur: 8, headcount: 900 }))
      .toEqual(matchingEffectiveInputs(noNumericTargets, base.opportunity))
    const scorerInputs = getSnapshotScoringInputs(base)
    expect(calculateOpportunityMatchScore(scorerInputs.repreneur, scorerInputs.opportunity)).toMatchObject({
      score: 100, recommendation: "strong_fit",
    })
  })
})
