/**
 * Approved sector choices for the staff new-opportunity form (PDR 1ef344f0).
 *
 * This list is intentionally local to opportunity creation. It does not replace
 * the older cross-product taxonomy or remap persisted opportunity sectors.
 */
export const NEW_OPPORTUNITY_SECTORS = [
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

export type NewOpportunitySector = (typeof NEW_OPPORTUNITY_SECTORS)[number]

export const OTHER_SECTOR: NewOpportunitySector = "Autre"

export type NewOpportunitySectorResolution =
  | { value: string; fieldError: null }
  | { value: null; fieldError: { field: "sector_choice" | "sector_other"; message: string } }

function readTrimmedString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveNewOpportunitySector(
  choiceValue: FormDataEntryValue | null,
  otherValue: FormDataEntryValue | null,
): NewOpportunitySectorResolution {
  const choice = readTrimmedString(choiceValue)

  if (!choice || !NEW_OPPORTUNITY_SECTORS.includes(choice as NewOpportunitySector)) {
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
