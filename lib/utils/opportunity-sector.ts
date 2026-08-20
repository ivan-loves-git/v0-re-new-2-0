/** The one selectable sector taxonomy shared by intake, deal flow, and matching. */
export const SECTOR_TAXONOMY = [
  "Agroalimentaire",
  "Industrie manufacturière",
  "Industrie lourde",
  "Industrie pharmaceutique & Dispositifs médicaux",
  "Services de santé",
  "Automobile & Mobilité",
  "Textile, Luxe & Mode",
  "Commerce, Négoce & Distribution",
  "BTP & Construction",
  "Services aux entreprises (B2B)",
  "Services aux particuliers (B2C)",
  "Tech & Digital",
  "Environnement & Énergie",
  "Hôtellerie, Restauration & Loisirs",
  "Transport & Logistique",
  "Autre",
] as const

export type Sector = (typeof SECTOR_TAXONOMY)[number]

/** Backwards-compatible name for the opportunity form consumer. */
export const NEW_OPPORTUNITY_SECTORS = SECTOR_TAXONOMY

export const SECTOR_OPTIONS: ReadonlyArray<{ value: Sector; label: Sector }> =
  SECTOR_TAXONOMY.map((sector) => ({ value: sector, label: sector }))

export const OTHER_SECTOR: Sector = "Autre"

export type NewOpportunitySectorResolution =
  | { value: string; fieldError: null }
  | { value: null; fieldError: { field: "sector_choice" | "sector_other"; message: string } }

function readTrimmedString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function comparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

const CANONICAL_BY_KEY = new Map(
  SECTOR_TAXONOMY.map((sector) => [comparable(sector), sector] as const),
)

/**
 * Compatibility expansions preserve the breadth of old categories. In
 * particular, the former Sante and Services choices intentionally expand to
 * both of their approved successors instead of guessing a narrower intent.
 */
const LEGACY_SECTOR_COMPATIBILITY: Record<string, readonly Sector[]> = {
  industrie: ["Industrie manufacturière"],
  industry: ["Industrie manufacturière"],
  lightindustry: ["Industrie manufacturière"],
  manufacturing: ["Industrie manufacturière"],
  sante: ["Industrie pharmaceutique & Dispositifs médicaux", "Services de santé"],
  santeassurancesociale: ["Industrie pharmaceutique & Dispositifs médicaux", "Services de santé"],
  santemedical: ["Industrie pharmaceutique & Dispositifs médicaux", "Services de santé"],
  healthcare: ["Industrie pharmaceutique & Dispositifs médicaux", "Services de santé"],
  automobile: ["Automobile & Mobilité"],
  luxemode: ["Textile, Luxe & Mode"],
  commercedistribution: ["Commerce, Négoce & Distribution"],
  retail: ["Commerce, Négoce & Distribution"],
  retaildistribution: ["Commerce, Négoce & Distribution"],
  btpconstruction: ["BTP & Construction"],
  construction: ["BTP & Construction"],
  services: ["Services aux entreprises (B2B)", "Services aux particuliers (B2C)"],
  b2bservices: ["Services aux entreprises (B2B)"],
  servicesauxentreprises: ["Services aux entreprises (B2B)"],
  servicesprofessionnels: ["Services aux entreprises (B2B)"],
  servicesauxparticuliers: ["Services aux particuliers (B2C)"],
  techdigital: ["Tech & Digital"],
  technologieit: ["Tech & Digital"],
  digitalitservices: ["Tech & Digital"],
  environnement: ["Environnement & Énergie"],
  environment: ["Environnement & Énergie"],
  energieenvironnement: ["Environnement & Énergie"],
  hotellerierestauration: ["Hôtellerie, Restauration & Loisirs"],
  restaurationhotellerie: ["Hôtellerie, Restauration & Loisirs"],
  hospitality: ["Hôtellerie, Restauration & Loisirs"],
  transportlogistique: ["Transport & Logistique"],
  transportentreposage: ["Transport & Logistique"],
  logistics: ["Transport & Logistique"],
  other: ["Autre"],
  autre: ["Autre"],
}

export function isSector(value: string): value is Sector {
  return CANONICAL_BY_KEY.get(comparable(value)) === value
}

export function sectorCompatibilityValues(value: string | null | undefined): Sector[] {
  const trimmed = value?.trim()
  if (!trimmed) return []
  const key = comparable(trimmed)
  const canonical = CANONICAL_BY_KEY.get(key)
  if (canonical) return [canonical]
  return [...(LEGACY_SECTOR_COMPATIBILITY[key] ?? [OTHER_SECTOR])]
}

/**
 * Canonicalizes multi-select answers. Unknown historic/custom values can be
 * retained for a visible "existing selection" compatibility path.
 */
export function canonicalSectorSelections(
  values: readonly string[],
  preserveUnknown = true,
): string[] {
  const canonical: string[] = []
  for (const rawValue of values) {
    const value = rawValue?.trim()
    if (!value) continue
    const key = comparable(value)
    const mapped = CANONICAL_BY_KEY.get(key)
      ? [CANONICAL_BY_KEY.get(key)!]
      : LEGACY_SECTOR_COMPATIBILITY[key]
    for (const item of mapped ?? (preserveUnknown ? [value] : [])) {
      if (!canonical.includes(item)) canonical.push(item)
    }
  }
  return canonical
}

/**
 * A single-valued opportunity can only be rewritten when the mapping has one
 * unambiguous successor. Broad/custom values are preserved until classified.
 */
export function normalizeOpportunitySector(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const key = comparable(trimmed)
  const canonical = CANONICAL_BY_KEY.get(key)
  if (canonical) return canonical
  const mapped = LEGACY_SECTOR_COMPATIBILITY[key]
  return mapped?.length === 1 ? mapped[0] : trimmed
}

export function isAmbiguousLegacySector(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return false
  return (LEGACY_SECTOR_COMPATIBILITY[comparable(trimmed)]?.length ?? 0) > 1
}

export function opportunityMatchesSectorFilter(
  value: string | null | undefined,
  selected: Sector,
) {
  return sectorCompatibilityValues(value).includes(selected)
}

/** Replaces any browser-generated select fallback with the controlled UI value. */
export function setOpportunitySectorChoiceForSubmission(
  formData: FormData,
  sectorChoice: string,
) {
  formData.set("sector_choice", sectorChoice)
}

export function resolveNewOpportunitySector(
  choiceValue: FormDataEntryValue | null,
  otherValue: FormDataEntryValue | null,
): NewOpportunitySectorResolution {
  const choice = readTrimmedString(choiceValue)

  if (!choice || !SECTOR_TAXONOMY.includes(choice as Sector)) {
    return {
      value: null,
      fieldError: {
        field: "sector_choice",
        message: "Select an approved sector.",
      },
    }
  }

  if (choice !== OTHER_SECTOR) {
    return { value: choice, fieldError: null }
  }

  const other = readTrimmedString(otherValue)
  if (!other) {
    return {
      value: null,
      fieldError: {
        field: "sector_other",
        message: "Specify the other sector.",
      },
    }
  }

  if (other.length > 120) {
    return {
      value: null,
      fieldError: {
        field: "sector_other",
        message: "Other sector must be 120 characters or fewer.",
      },
    }
  }

  return { value: other, fieldError: null }
}
