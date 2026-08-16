import type { MaOfficeIntakeOffice } from "@/lib/types/opportunity"

/** W-109 fails closed unless both real source identity and a named contact are explicit. */
export function eligibleExternalPursuitConversionOffices(
  offices: MaOfficeIntakeOffice[],
) {
  return offices
    .filter(
      (office) => office.firm_status === "active" &&
        office.is_default === false &&
        office.is_provisional_source === false,
    )
    .map((office) => ({
      ...office,
      contacts: office.contacts.filter(
        (contact) => Boolean(contact.contact_name?.trim()),
      ),
    }))
    .filter((office) => office.contacts.length > 0)
}
