import {
  isCandidateStaleOpportunity,
  isCountedSourcedOpportunity,
  isOpenRelationshipOpportunity,
} from "@/lib/opportunity-freshness-policy"

export interface MaRelationshipStatisticOffice {
  id: string
  firmId: string | null
}

export interface MaRelationshipStatisticAffiliation {
  officeId: string
  contactId: string
  isActive: boolean
  endedAt: string | null
  contactStatus: "active" | "archived" | null
}

export interface MaRelationshipStatisticOpportunity {
  id: string
  officeId: string | null
  status: "draft" | "active" | "paused" | "archived" | "closed"
  dateAdded: string | null
  dateAddedPrecision?: "day" | "month" | null
}

export interface MaRelationshipOfficeStatistics {
  activeContactCount: number
  sourcedOpportunityCount: number
  openOpportunityCount: number
  candidateStaleCount: number
  latestKnownAt: string | null
  latestKnownAtPrecision: "day" | "month" | null
}

export interface MaRelationshipFirmStatistics extends MaRelationshipOfficeStatistics {
  officeCount: number
}

export interface MaRelationshipStatistics {
  byOfficeId: Map<string, MaRelationshipOfficeStatistics>
  byFirmId: Map<string, MaRelationshipFirmStatistics>
}

function dateTimestamp(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function laterDate(
  current: string | null,
  candidate: string | null | undefined,
) {
  const candidateTimestamp = dateTimestamp(candidate)
  if (candidateTimestamp === null) return current
  const currentTimestamp = dateTimestamp(current)
  return currentTimestamp === null || candidateTimestamp > currentTimestamp
    ? candidate!
    : current
}

function emptyOfficeStatistics(): MaRelationshipOfficeStatistics {
  return {
    activeContactCount: 0,
    sourcedOpportunityCount: 0,
    openOpportunityCount: 0,
    candidateStaleCount: 0,
    latestKnownAt: null,
    latestKnownAtPrecision: null,
  }
}

/**
 * Computes read-only firm and office indicators from canonical records. Firm
 * contact counts deduplicate people who have active affiliations at multiple
 * offices in the same firm; opportunity totals remain office-source based.
 */
export function buildMaRelationshipStatistics(
  offices: MaRelationshipStatisticOffice[],
  affiliations: MaRelationshipStatisticAffiliation[],
  opportunities: MaRelationshipStatisticOpportunity[],
  activePursuitOpportunityIds: Iterable<string>,
  now = new Date(),
): MaRelationshipStatistics {
  const byOfficeId = new Map<string, MaRelationshipOfficeStatistics>()
  const officeFirmIds = new Map<string, string>()
  const officeContactIds = new Map<string, Set<string>>()
  const firmContactIds = new Map<string, Set<string>>()

  for (const office of offices) {
    byOfficeId.set(office.id, emptyOfficeStatistics())
    if (office.firmId) officeFirmIds.set(office.id, office.firmId)
  }

  for (const affiliation of affiliations) {
    if (
      !affiliation.isActive ||
      affiliation.endedAt !== null ||
      affiliation.contactStatus !== "active"
    ) {
      continue
    }
    const officeContacts =
      officeContactIds.get(affiliation.officeId) ?? new Set()
    officeContacts.add(affiliation.contactId)
    officeContactIds.set(affiliation.officeId, officeContacts)
    const firmId = officeFirmIds.get(affiliation.officeId)
    if (!firmId) continue
    const firmContacts = firmContactIds.get(firmId) ?? new Set()
    firmContacts.add(affiliation.contactId)
    firmContactIds.set(firmId, firmContacts)
  }

  for (const [officeId, contactIds] of officeContactIds) {
    const statistics = byOfficeId.get(officeId)
    if (statistics) statistics.activeContactCount = contactIds.size
  }

  const activePursuits = new Set(activePursuitOpportunityIds)
  for (const opportunity of opportunities) {
    if (!opportunity.officeId) continue
    const statistics = byOfficeId.get(opportunity.officeId)
    if (!statistics) continue
    const latestKnownAt = laterDate(statistics.latestKnownAt, opportunity.dateAdded)
    if (latestKnownAt !== statistics.latestKnownAt) {
      statistics.latestKnownAt = latestKnownAt
      statistics.latestKnownAtPrecision = opportunity.dateAddedPrecision ?? null
    }
    if (!isCountedSourcedOpportunity(opportunity.status)) continue
    statistics.sourcedOpportunityCount += 1
    if (isOpenRelationshipOpportunity(opportunity.status)) {
      statistics.openOpportunityCount += 1
    }
    if (isCandidateStaleOpportunity(opportunity, activePursuits, now)) {
      statistics.candidateStaleCount += 1
    }
  }

  const byFirmId = new Map<string, MaRelationshipFirmStatistics>()
  for (const office of offices) {
    if (!office.firmId) continue
    const officeStatistics =
      byOfficeId.get(office.id) ?? emptyOfficeStatistics()
    const firmStatistics = byFirmId.get(office.firmId) ?? {
      ...emptyOfficeStatistics(),
      officeCount: 0,
    }
    firmStatistics.officeCount += 1
    firmStatistics.sourcedOpportunityCount +=
      officeStatistics.sourcedOpportunityCount
    firmStatistics.openOpportunityCount += officeStatistics.openOpportunityCount
    firmStatistics.candidateStaleCount += officeStatistics.candidateStaleCount
    const latestKnownAt = laterDate(
      firmStatistics.latestKnownAt,
      officeStatistics.latestKnownAt,
    )
    if (latestKnownAt !== firmStatistics.latestKnownAt) {
      firmStatistics.latestKnownAt = latestKnownAt
      firmStatistics.latestKnownAtPrecision = officeStatistics.latestKnownAtPrecision
    }
    byFirmId.set(office.firmId, firmStatistics)
  }

  for (const [firmId, statistics] of byFirmId) {
    statistics.activeContactCount = firmContactIds.get(firmId)?.size ?? 0
  }

  return { byOfficeId, byFirmId }
}
