import type { OpportunityStatus } from "@/lib/types/opportunity"

export const STALE_OPPORTUNITY_DAYS = 90

export const CANDIDATE_STALE_OPPORTUNITY_STATUSES = [
  "draft",
  "active",
  "paused",
] as const satisfies readonly OpportunityStatus[]

const candidateStaleStatuses = new Set<OpportunityStatus>(
  CANDIDATE_STALE_OPPORTUNITY_STATUSES,
)

export function parseOpportunityDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function opportunityDaysOpen(
  value: string | null | undefined,
  now: Date,
) {
  const date = parseOpportunityDate(value)
  if (!date) return null
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(
    0,
    Math.floor((today.getTime() - start.getTime()) / 86_400_000),
  )
}

export function isCandidateStaleOpportunity(
  opportunity: {
    id: string
    status: OpportunityStatus
    dateAdded: string | null
  },
  activePursuitOpportunityIds: ReadonlySet<string>,
  now: Date,
) {
  if (!candidateStaleStatuses.has(opportunity.status)) return false
  if (activePursuitOpportunityIds.has(opportunity.id)) return false
  const daysOpen = opportunityDaysOpen(opportunity.dateAdded, now)
  return daysOpen !== null && daysOpen >= STALE_OPPORTUNITY_DAYS
}

export function isOpenRelationshipOpportunity(status: OpportunityStatus) {
  return status === "active" || status === "paused"
}

export function isCountedSourcedOpportunity(status: OpportunityStatus) {
  return status !== "archived"
}
