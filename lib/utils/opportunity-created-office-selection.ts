import type { MaOfficeIntakeOffice } from "@/lib/types/opportunity";

type OfficeContextMode = "new_firm" | "existing_firm";

export interface CreatedOfficeSelection {
  selectedOfficeId: string;
  affiliationIds: string[];
  primaryAffiliationId: string | null;
}

/**
 * Radix may emit an empty value while a sibling dialog form settles. That is
 * not a staff choice and must not clear a newly selected source. The explicit
 * no-office option remains the only supported clear action.
 */
export function resolveOpportunityOfficeChoice(
  value: string,
  noOfficeOptionValue: string,
): string | null {
  if (!value) return null;
  return value === noOfficeOptionValue ? "" : value;
}

/**
 * Applies the safe, local form selection after an inline source action has
 * returned its committed office. A new firm action creates exactly one first
 * contact; adding an office to an existing firm deliberately does not.
 */
export function selectCreatedOfficeContext(
  office: MaOfficeIntakeOffice,
  mode: OfficeContextMode,
): CreatedOfficeSelection {
  const firstContact = mode === "new_firm" ? office.contacts[0] : null;

  return {
    selectedOfficeId: office.office_id,
    affiliationIds: firstContact ? [firstContact.affiliation_id] : [],
    primaryAffiliationId: firstContact?.affiliation_id ?? null,
  };
}
