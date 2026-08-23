import type { MaOfficeIntakeOffice } from "@/lib/types/opportunity"

/**
 * Narrows the inline existing-firm choice to offices which remain eligible
 * for staff intake. The database projection applies the same lifecycle rule;
 * keeping it here prevents a stale client payload from crossing firms.
 */
export function existingFirmEligibleOfficeOptions(
  firmId: string,
  offices: MaOfficeIntakeOffice[],
): MaOfficeIntakeOffice[] {
  const firmOffices = offices.filter(
    (office) => office.firm_id === firmId && office.firm_status === "active",
  )
  const hasRealActiveOffice = firmOffices.some(
    (office) => office.is_default !== true,
  )

  return firmOffices.filter(
    (office) => !hasRealActiveOffice || office.is_default !== true,
  )
}

export function isExistingFirmOfficeSelection(
  officeId: string,
  firmId: string,
  offices: MaOfficeIntakeOffice[],
): boolean {
  return existingFirmEligibleOfficeOptions(firmId, offices).some(
    (office) => office.office_id === officeId,
  )
}
