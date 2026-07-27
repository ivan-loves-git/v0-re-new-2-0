import type { MaRelationshipTimelineItem } from "@/lib/actions/ma-relationships"

export interface MaRelationshipTimelineFilters {
  officeId?: string | null
  contactId?: string | null
  opportunityId?: string | null
}

/**
 * Contact filtering is based on the canonical contact identity, not a single
 * office affiliation. A person can have several affiliations while the office
 * filter composes independently.
 */
export function filterMaRelationshipTimeline(
  interactions: MaRelationshipTimelineItem[],
  filters: MaRelationshipTimelineFilters,
) {
  return interactions.filter((interaction) => {
    if (filters.officeId && interaction.officeId !== filters.officeId)
      return false
    if (filters.contactId && interaction.contactId !== filters.contactId)
      return false
    if (
      filters.opportunityId &&
      interaction.opportunityId !== filters.opportunityId
    )
      return false
    return true
  })
}
