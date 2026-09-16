import type { MaRelationshipTimelineItem } from "@/lib/actions/ma-relationships"

export const MA_RELATIONSHIP_GLOBAL_ACTIVITY_LIMIT = 250

export function maRelationshipResultSummary(matched: number, loaded: number) {
  return {
    count: `${matched} of ${loaded} loaded ${loaded === 1 ? "activity" : "activities"}`,
    windowNotice: loaded >= MA_RELATIONSHIP_GLOBAL_ACTIVITY_LIMIT
      ? `Filters apply only to the latest ${MA_RELATIONSHIP_GLOBAL_ACTIVITY_LIMIT} loaded activities. Older activity is not included.`
      : null,
  }
}

export interface MaRelationshipTimelineFilters {
  officeId?: string | null
  contactId?: string | null
  opportunityId?: string | null
}

/**
 * Contact filtering is based on the canonical contact identity, not the one
 * current affiliation. Historical interactions can still belong to earlier
 * office affiliations, so the office filter composes independently.
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
