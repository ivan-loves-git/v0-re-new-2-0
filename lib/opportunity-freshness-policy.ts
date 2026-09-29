import type { OpportunityStatus } from "@/lib/types/opportunity"
import {
  dayLevelOpportunityDate,
  type OpportunitySourceDatePrecision,
} from "@/lib/utils/opportunity-source-date"

export const STALE_OPPORTUNITY_DAYS = 45

export const CANDIDATE_STALE_OPPORTUNITY_STATUSES = [
  "active",
] as const satisfies readonly OpportunityStatus[]

const candidateStaleStatuses = new Set<OpportunityStatus>(
  CANDIDATE_STALE_OPPORTUNITY_STATUSES,
)

export function parseOpportunityDate(
  value: string | null | undefined,
  precision?: OpportunitySourceDatePrecision,
) {
  return dayLevelOpportunityDate(value, precision)
}

export function opportunityDaysOpen(
  value: string | null | undefined,
  now: Date,
  precision?: OpportunitySourceDatePrecision,
) {
  const date = parseOpportunityDate(value, precision)
  if (!date) return null
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  return Math.max(
    0,
    Math.floor((today - start) / 86_400_000),
  )
}

export interface FreshnessClockInput {
  status: string
  isDemo: boolean
  hasActiveRealPursuit: boolean
  dateAdded: string | null
  dateAddedPrecision?: OpportunitySourceDatePrecision
  confirmation?: { id: string; at: string } | null
}

function recordedDay(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null
  const day = value.slice(0, 10)
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? parsed : null
}

function calendarAge(start: Date, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((today - start.getTime()) / 86_400_000)
}

/** A recorded clock can be younger than the rule threshold. The technical
 * first of a known month is not an exact source day; its last possible day is
 * the conservative lower bound on inventory age. */
export function recordedFreshnessClock(input: Pick<FreshnessClockInput, "dateAdded" | "dateAddedPrecision" | "confirmation">, now: Date): {
  episode: string
  basis: "confirmed_open" | "recorded_source_day" | "older_inventory_no_confirmation"
  ageDays: number
} | null {
  if (input.confirmation) {
    const day = recordedDay(input.confirmation.at)
    if (!day) return null
    return { episode: input.confirmation.id, basis: "confirmed_open", ageDays: calendarAge(day, now) }
  }
  const storedDay = recordedDay(input.dateAdded)
  if (!storedDay) return null
  const conservativeDay = input.dateAddedPrecision === "month"
    ? new Date(Date.UTC(storedDay.getUTCFullYear(), storedDay.getUTCMonth() + 1, 0))
    : storedDay
  const ageDays = calendarAge(conservativeDay, now)
  return {
    episode: "initial",
    basis: input.dateAddedPrecision === "day" ? "recorded_source_day" : "older_inventory_no_confirmation",
    ageDays,
  }
}

export function freshnessDueBasis(input: FreshnessClockInput, now: Date) {
  if (input.status !== "active" || input.isDemo || input.hasActiveRealPursuit) return null
  const clock = recordedFreshnessClock(input, now)
  return clock && clock.ageDays >= STALE_OPPORTUNITY_DAYS ? clock : null
}

export function isCandidateStaleOpportunity(
  opportunity: {
    id: string
    status: OpportunityStatus
    dateAdded: string | null
    dateAddedPrecision?: OpportunitySourceDatePrecision
    confirmation?: { id: string; at: string } | null
  },
  activePursuitOpportunityIds: ReadonlySet<string>,
  now: Date,
) {
  if (!candidateStaleStatuses.has(opportunity.status)) return false
  return freshnessDueBasis({
    status: opportunity.status, isDemo: false,
    hasActiveRealPursuit: activePursuitOpportunityIds.has(opportunity.id),
    dateAdded: opportunity.dateAdded, dateAddedPrecision: opportunity.dateAddedPrecision,
    confirmation: opportunity.confirmation,
  }, now) !== null
}

export function isOpenRelationshipOpportunity(status: OpportunityStatus) {
  return status === "active" || status === "paused"
}

export function isCountedSourcedOpportunity(status: OpportunityStatus) {
  return status !== "archived"
}

export function isClosedOpportunity(status: OpportunityStatus) {
  return status === "closed"
}
