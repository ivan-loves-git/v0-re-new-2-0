/** Staff display only. Canonical names and office IDs are never rewritten. */
export interface MaOfficeIdentity {
  id: string
  firmName: string | null | undefined
  officeName: string | null | undefined
  isProvisionalSource?: boolean
}

function comparableName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

function missingName(value: string | null | undefined) {
  return ["", "(à compléter)", "à compléter", "unknown firm", "unknown office"].includes(
    comparableName(value),
  )
}

export function presentMaOffice(office: MaOfficeIdentity) {
  const firmMissing = missingName(office.firmName)
  const officeMissing = missingName(office.officeName)
  const needsReview = firmMissing || officeMissing
  const primary = firmMissing ? "Firm name missing" : office.firmName!.trim()
  const secondary = officeMissing
    ? "Office name missing"
    : comparableName(office.firmName) === comparableName(office.officeName)
      ? null
      : office.officeName!.trim()
  const label = [primary, secondary].filter(Boolean).join(" · ")
  const identity = `Firm: ${office.firmName || "Name missing"}; Office: ${office.officeName || "Name missing"}; Office ID: ${office.id}`
  return {
    id: office.id,
    primary,
    secondary,
    label,
    identity,
    needsReview,
    isProvisionalSource: office.isProvisionalSource === true,
    searchText: [office.firmName, office.officeName, office.id, label,
      needsReview ? "name missing needs review" : "",
      office.isProvisionalSource ? "provisional source" : "",
    ].filter(Boolean).join(" "),
  }
}

export function presentMaOfficeOptions(offices: readonly MaOfficeIdentity[]) {
  const options = offices.map(presentMaOffice)
  const counts = new Map<string, number>()
  for (const option of options) {
    const key = comparableName(option.label)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return options.map((option) => ({
    ...option,
    // Full IDs are deliberate: truncated UUIDs do not guarantee disambiguation.
    reference: option.needsReview || (counts.get(comparableName(option.label)) ?? 0) > 1
      ? `Office ID: ${option.id}`
      : null,
  }))
}

/** Accent folding is for search, never for identity equality or stored names. */
export function matchesMaOfficeSearch(searchText: string, query: string) {
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const haystack = fold(searchText)
  return fold(query).trim().split(/\s+/).every((term) => haystack.includes(term))
}
