/**
 * The six inputs the current automatic scorer actually consumes. Optional
 * revenue, margin and staff-size preferences remain matching context only and
 * must never hide a staff recommendation or block discovery by themselves.
 */
export type AutomaticMatchingThesis = {
  who_score?: number | null
  when_score?: number | null
  scoring_flags?: string[] | null
  q12_geo_zones?: string | string[] | null
  q13_target_sectors_v2?: string | string[] | null
  q14_deal_size?: string | string[] | null
  target_location?: string | string[] | null
  sector_preferences?: string | string[] | null
  target_acquisition_size?: string | null
  target_revenue_min_meur?: number | null
  target_revenue_max_meur?: number | null
  target_ebitda_margin_min_pct?: number | null
  target_staff_size_min?: number | null
  target_staff_size_max?: number | null
}

export type TargetThesisCompleteness = {
  complete: boolean
  missing: Array<
    "WHO score" | "WHEN score" | "matching flags" | "geography" | "sectors" | "deal size"
  >
}

function hasFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
}

function hasSelection(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.some((item) => typeof item === "string" && item.trim().length > 0)
  return typeof value === "string" && value.trim().length > 0
}

function hasCanonicalOrLegacySelection(
  canonical: string | string[] | null | undefined,
  legacy: string | string[] | null | undefined,
) {
  return hasSelection(canonical) || hasSelection(legacy)
}

export function automaticMatchingThesisCompleteness(
  repreneur: AutomaticMatchingThesis,
): TargetThesisCompleteness {
  const missing: TargetThesisCompleteness["missing"] = []
  if (!hasFiniteNumber(repreneur.who_score)) missing.push("WHO score")
  if (!hasFiniteNumber(repreneur.when_score)) missing.push("WHEN score")
  if (!Array.isArray(repreneur.scoring_flags)) missing.push("matching flags")
  if (!hasCanonicalOrLegacySelection(repreneur.q12_geo_zones, repreneur.target_location)) missing.push("geography")
  if (!hasCanonicalOrLegacySelection(repreneur.q13_target_sectors_v2, repreneur.sector_preferences)) missing.push("sectors")
  if (!hasCanonicalOrLegacySelection(repreneur.q14_deal_size, repreneur.target_acquisition_size)) missing.push("deal size")

  return { complete: missing.length === 0, missing }
}
