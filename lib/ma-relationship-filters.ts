import type { MaRelationshipTimelineItem } from "@/lib/actions/ma-relationships"

export const MA_RELATIONSHIP_GLOBAL_ACTIVITY_LIMIT = 250

export function maRelationshipResultSummary(
  matched: number,
  loaded: number,
  globalActivityWindowSaturated: boolean,
) {
  return {
    count: `${matched} of ${loaded} loaded ${loaded === 1 ? "activity" : "activities"}`,
    windowNotice: globalActivityWindowSaturated
      ? `Filters apply only to the latest ${MA_RELATIONSHIP_GLOBAL_ACTIVITY_LIMIT} queried activities. Older activity is not included.`
      : null,
    emptyMessage: matched > 0
      ? null
      : loaded === 0
        ? "No staff-visible activity in the loaded window."
        : "No loaded activity matches these filters.",
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
