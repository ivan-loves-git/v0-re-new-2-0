import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"
import { buildGeographyPaths } from "@/lib/repreneur-opportunity-geography"
import {
  MATCHING_V2_CONFIG,
  matchingEffectiveInputs,
} from "@/lib/utils/opportunity-match-scoring"

type MatchSnapshot = {
  match: {
    id: string
    repreneur_id: string
    opportunity_id: string
    revision: number
    platform_score: number | null
    platform_recommendation: string
    platform_reasons: string[]
  }
  repreneur: Record<string, unknown> & { is_demo: boolean; revision: number; target_revision: number }
  opportunity: Record<string, unknown> & { is_demo: boolean; revision: number; geography_node_id: string | null }
  target_node_ids: string[]
  geography_nodes: Array<{ id: string; stable_key: string; parent_id: string | null }>
  taxonomy_revision: number
  provenance: {
    platform_scoring_version: string | null
    platform_inputs_hmac: string | null
    platform_scored_at: string | null
  } | null
}

export type MatchFreshness = "Fresh" | "Stale" | "Unknown"
export type MatchScoreDisplay = {
  freshness: MatchFreshness
  platform_score: number | null
  platform_recommendation: string
  platform_reasons: string[]
}

function validSnapshot(value: unknown): value is MatchSnapshot {
  if (!value || typeof value !== "object") return false
  const row = value as Partial<MatchSnapshot>
  return !!row.match && typeof row.match.id === "string"
    && !!row.repreneur && typeof row.repreneur.is_demo === "boolean"
    && !!row.opportunity && typeof row.opportunity.is_demo === "boolean"
    && Array.isArray(row.target_node_ids) && Array.isArray(row.geography_nodes)
    && Number.isSafeInteger(row.match.revision)
    && Number.isSafeInteger(row.repreneur.revision)
    && Number.isSafeInteger(row.repreneur.target_revision)
    && Number.isSafeInteger(row.opportunity.revision)
    && Number.isSafeInteger(row.taxonomy_revision)
}

export async function loadMatchScoreSnapshot(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchSnapshot | null> {
  const { data, error } = await supabase.rpc("match_score_source_snapshot", { p_match_id: matchId })
  if (error) throw new Error(error.message)
  return validSnapshot(data) && data.match.id === matchId ? data : null
}

function scoreInputs(snapshot: MatchSnapshot) {
  const nodes = snapshot.geography_nodes.filter((node) =>
    typeof node.id === "string" && typeof node.stable_key === "string",
  )
  const paths = buildGeographyPaths(nodes)
  const repreneur = {
    ...snapshot.repreneur,
    target_geography_paths_stable_keys: snapshot.target_node_ids.flatMap((id) => {
      const path = paths.get(id)
      return path ? [path] : []
    }),
  }
  const opportunity = {
    ...snapshot.opportunity,
    geography_path_stable_keys: snapshot.opportunity.geography_node_id
      ? paths.get(snapshot.opportunity.geography_node_id) ?? []
      : [],
  }
  return { repreneur, opportunity }
}

export function getSnapshotScoringInputs(snapshot: MatchSnapshot) {
  return scoreInputs(snapshot)
}

export function signMatchInputs(snapshot: MatchSnapshot): string {
  const { repreneur, opportunity } = scoreInputs(snapshot)
  const consumed = matchingEffectiveInputs(repreneur, opportunity)
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`re-new:matching-2.2:guarded-inputs:v1\0${JSON.stringify(consumed)}`)
    .digest("hex")
}

export function freshnessFromSnapshot(snapshot: MatchSnapshot): MatchFreshness {
  const provenance = snapshot.provenance
  if (!provenance?.platform_scoring_version || !provenance.platform_scored_at
    || !provenance.platform_inputs_hmac?.match(/^[0-9a-f]{64}$/)) return "Unknown"
  try {
    const current = Buffer.from(signMatchInputs(snapshot), "hex")
    const stored = Buffer.from(provenance.platform_inputs_hmac, "hex")
    if (provenance.platform_scoring_version !== MATCHING_V2_CONFIG.version) return "Stale"
    return timingSafeEqual(current, stored) ? "Fresh" : "Stale"
  } catch {
    return "Unknown"
  }
}

/** Score and freshness are always projected from the same cohesive snapshot. */
export async function loadMatchScoreDisplay(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchScoreDisplay | null> {
  const snapshot = await loadMatchScoreSnapshot(supabase, matchId)
  if (!snapshot) return null
  return {
    freshness: freshnessFromSnapshot(snapshot),
    platform_score: snapshot.match.platform_score,
    platform_recommendation: snapshot.match.platform_recommendation,
    platform_reasons: snapshot.match.platform_reasons,
  }
}
