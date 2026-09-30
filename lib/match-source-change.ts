import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getSnapshotScoringInputs, loadMatchScoreSnapshot } from "@/lib/match-score-provenance"
import { matchingEffectiveInputs } from "@/lib/utils/opportunity-match-scoring"

const OPPORTUNITY_SOURCE_FIELDS = `is_demo,sector,activity,location,revenue_meur,ebitda_keur,headcount,geography_node_id`

export type RepreneurFitSource = ReturnType<typeof getSnapshotScoringInputs>["repreneur"]

export type OpportunityFitSource = {
  is_demo: boolean
  sector: string | null
  activity: string | null
  location: string | null
  revenue_meur: number | null
  ebitda_keur: number | null
  headcount: number | null
  geography_node_id: string | null
}

type FitSourceCapture<T> = { value: T; signature: string }

/** Conservative source-level gate; per-match HMAC remains the final relevance test. */
function repreneurSignature(value: Record<string, unknown>) {
  const effective = matchingEffectiveInputs(value as Parameters<typeof matchingEffectiveInputs>[0], {})
  return JSON.stringify({
    namespace: effective.namespace[0],
    sector: effective.sector.targets,
    geography: effective.geography,
    revenue: effective.revenue && { minimum: effective.revenue.minimum, maximum: effective.revenue.maximum },
    ebitda: effective.ebitda && { minimum: effective.ebitda.minimum, maximum: effective.ebitda.maximum },
    margin: effective.margin?.minimum ?? null,
    headcount: effective.headcount && { minimum: effective.headcount.minimum, maximum: effective.headcount.maximum },
  })
}

function opportunitySignature(value: OpportunityFitSource) {
  const effective = matchingEffectiveInputs({
    is_demo: false,
    q13_target_sectors_v2: ["Industrie manufacturière"],
    target_revenue_min_meur: 0, target_ebitda_min_keur: 0,
    target_ebitda_margin_min_pct: 0, target_staff_size_min: 0,
  }, value)
  return JSON.stringify({
    namespace: value.is_demo,
    sector: effective.sector.source,
    geographyNodeId: value.geography_node_id,
    geographyText: effective.geography.mode === "legacy" ? effective.geography.location : null,
    revenue: effective.revenue?.value ?? null,
    ebitda: effective.ebitda?.value ?? null,
    headcount: effective.headcount?.value ?? null,
  })
}

/** Before and after saves use the same existing one-statement match snapshot.
 * Its repreneur half includes the canonical target paths that can shadow q12.
 * With no saved match there is nothing to refresh.
 */
export async function captureRepreneurFitSource(supabase: SupabaseClient, id: string): Promise<FitSourceCapture<RepreneurFitSource> | null> {
  const { data, error } = await supabase.from("opportunity_matches").select("id")
    .eq("repreneur_id", id).order("id", { ascending: true }).limit(1).maybeSingle()
  if (error || !data) return null
  const snapshot = await loadMatchScoreSnapshot(supabase, data.id)
  if (!snapshot || snapshot.match.repreneur_id !== id) return null
  const value = getSnapshotScoringInputs(snapshot).repreneur
  return { value, signature: repreneurSignature(value) }
}

export async function captureOpportunityFitSource(supabase: SupabaseClient, id: string): Promise<FitSourceCapture<OpportunityFitSource> | null> {
  const { data, error } = await supabase.from("opportunities").select(OPPORTUNITY_SOURCE_FIELDS).eq("id", id).maybeSingle()
  if (error || !data) return null
  const value = data as OpportunityFitSource
  return { value, signature: opportunitySignature(value) }
}

export function fitSourceChanged<T>(before: FitSourceCapture<T> | null, after: FitSourceCapture<T> | null) {
  return Boolean(before && after && before.signature !== after.signature)
}
