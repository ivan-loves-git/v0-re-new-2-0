import {
  canonicalSectorSelections,
  sectorCompatibilityValues,
} from "@/lib/utils/opportunity-sector"

type ThesisOption = { value: string; label: string }

type SelectionKind = "geography" | "sector"

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
