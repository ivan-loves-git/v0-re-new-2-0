import {
  canonicalSectorSelections,
  sectorCompatibilityValues,
} from "@/lib/utils/opportunity-sector"

type ThesisOption = { value: string; label: string }

type SelectionKind = "geography" | "sector"

type TargetThesisValidationInput = {
  q12_geo_zones: string[]
  q13_target_sectors_v2: string[]
  q14_deal_size: string[]
  q16_equity: string
  target_revenue_min_meur: number | null
  target_revenue_max_meur: number | null
  target_ebitda_min_keur: number | null
  target_ebitda_max_keur: number | null
  target_ebitda_margin_min_pct: number | null
  target_staff_size_min: number | null
  target_staff_size_max: number | null
}

const LEGACY_SELECTION_ALIASES: Record<SelectionKind, Record<string, string>> = {
  geography: {},
  sector: {},
}

const MATCH_TERMS: Record<SelectionKind, Record<string, string[]>> = {
  geography: {},
  sector: {},
}

function comparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function optionalNumberValidationMessage(
  value: number | null,
  fieldName: string,
  maximum: number,
  integer = false,
) {
  if (value === null) return null
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    return `${fieldName} must be a number between 0 and ${maximum}.`
  }
  if (integer && !Number.isInteger(value)) {
    return `${fieldName} must be a whole number.`
  }
  return null
}

/** Gives both staff and repreneurs immediate feedback before a server save. */
export function targetThesisInputValidationMessage(input: TargetThesisValidationInput) {
  if (input.q12_geo_zones.length === 0) return "Geography needs at least one selection."
  if (input.q13_target_sectors_v2.length === 0) return "Sectors needs at least one selection."
  if (input.q14_deal_size.length === 0) return "Deal size needs at least one selection."
  if (!input.q16_equity) return "Investment capacity needs at least one selection."

  const numberError =
    optionalNumberValidationMessage(input.target_revenue_min_meur, "Revenue minimum", 100000) ??
    optionalNumberValidationMessage(input.target_revenue_max_meur, "Revenue maximum", 100000) ??
    optionalNumberValidationMessage(input.target_ebitda_min_keur, "EBITDA minimum", 100000) ??
    optionalNumberValidationMessage(input.target_ebitda_max_keur, "EBITDA maximum", 100000) ??
    optionalNumberValidationMessage(input.target_ebitda_margin_min_pct, "Minimum EBITDA margin", 100) ??
    optionalNumberValidationMessage(input.target_staff_size_min, "Staff-size minimum", 100000, true) ??
    optionalNumberValidationMessage(input.target_staff_size_max, "Staff-size maximum", 100000, true)
  if (numberError) return numberError

  if (
    input.target_ebitda_min_keur !== null &&
    input.target_ebitda_max_keur !== null &&
    input.target_ebitda_min_keur > input.target_ebitda_max_keur
  ) {
    return "EBITDA range minimum cannot be greater than its maximum."
  }
  if (
    input.target_revenue_min_meur !== null &&
    input.target_revenue_max_meur !== null &&
    input.target_revenue_min_meur > input.target_revenue_max_meur
  ) {
    return "Revenue range minimum cannot be greater than its maximum."
  }
  if (
    input.target_staff_size_min !== null &&
    input.target_staff_size_max !== null &&
    input.target_staff_size_min > input.target_staff_size_max
  ) {
    return "Staff-size range minimum cannot be greater than its maximum."
  }

  return null
}

/**
 * Moves recognized historic labels onto the v2 value set on the first edit,
 * while retaining a profile's existing custom value until the owner removes it.
 */
export function canonicalTargetThesisValues(
  values: string[],
  options: ReadonlyArray<ThesisOption>,
  kind?: SelectionKind,
) {
  if (kind === "sector") {
    return unique(canonicalSectorSelections(values))
  }

  const configuredValues = new Map<string, string>()
  for (const option of options) {
    configuredValues.set(comparable(option.value), option.value)
    configuredValues.set(comparable(option.label), option.value)
  }

  const aliases = kind ? LEGACY_SELECTION_ALIASES[kind] : {}
  return unique(
    values
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => {
        const key = comparable(value)
        return configuredValues.get(key) ?? aliases[key] ?? value
      }),
  )
}

export function legacyTargetThesisValues(
  values: string[],
  options: ReadonlyArray<ThesisOption>,
  kind?: SelectionKind,
) {
  const canonical = canonicalTargetThesisValues(values, options, kind)
  const allowed = new Set(options.map((option) => option.value))
  return canonical.filter((value) => !allowed.has(value))
}

export function targetThesisLabels(values: string[], options: ReadonlyArray<ThesisOption>) {
  const labels = new Map(options.map((option) => [option.value, option.label]))
  return values.map((value) => labels.get(value) ?? value)
}

/**
 * Canonical questionnaire values are identifiers, while opportunities may use
 * natural-language sector or geographic labels. Supply both representations
 * so a self-service edit does not make previously matching deals disappear.
 */
export function targetThesisMatchTerms(
  values: string[],
  options: ReadonlyArray<ThesisOption>,
  kind: SelectionKind,
) {
  const labels = new Map(options.map((option) => [option.value, option.label]))
  if (kind === "sector") {
    return unique(
      canonicalTargetThesisValues(values, options, kind).flatMap((value) => {
        if (value === "all") return [value]
        const compatible = sectorCompatibilityValues(value)
        if (compatible.length === 0) return [value]
        return [value, ...compatible]
      }),
    )
  }

  return unique(
    canonicalTargetThesisValues(values, options, kind).flatMap((value) => [
      value,
      labels.get(value) ?? value,
      ...(MATCH_TERMS[kind][value] ?? []),
    ]),
  )
}
