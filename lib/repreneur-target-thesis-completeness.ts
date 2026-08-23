/** Matching v2 discovery inputs. Staff recommendations always bypass this gate. */
export type AutomaticMatchingThesis = {
  // Qualification and legacy bucket fields are accepted from existing profile
  // queries but do not gate signed-client Matching v2 discovery.
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
  missing: Array<"geography" | "sectors" | "financial or size target">
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
  if (!hasCanonicalOrLegacySelection(repreneur.q12_geo_zones, repreneur.target_location)) missing.push("geography")
  if (!hasCanonicalOrLegacySelection(repreneur.q13_target_sectors_v2, repreneur.sector_preferences)) missing.push("sectors")
  if (![
    repreneur.target_revenue_min_meur,
    repreneur.target_revenue_max_meur,
    repreneur.target_ebitda_margin_min_pct,
    repreneur.target_staff_size_min,
    repreneur.target_staff_size_max,
  ].some(hasFiniteNumber)) {
    missing.push("financial or size target")
  }

  return { complete: missing.length === 0, missing }
}
