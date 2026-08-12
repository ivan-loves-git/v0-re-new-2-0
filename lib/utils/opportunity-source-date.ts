export type OpportunitySourceDatePrecision = "day" | "month" | null | undefined

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * A month-only CRM date is stored at the first of its month for database
 * sorting. That technical day is not source evidence and must never become a
 * user-facing calendar date.
 */
export function formatOpportunitySourceDate(
  value: string | null | undefined,
  precision: OpportunitySourceDatePrecision,
  options: { fallback?: string } = {},
) {
  const date = parseDateOnly(value)
  if (!date) return options.fallback ?? "-"
  if (precision === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date)
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function formatOpportunitySourceMonth(
  value: string | null | undefined,
  options: { fallback?: string } = {},
) {
  const date = parseDateOnly(value)
  if (!date) return options.fallback ?? "-"
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/** A month-only source value is deliberately unavailable to day-level rules. */
export function dayLevelOpportunityDate(
  value: string | null | undefined,
  precision: OpportunitySourceDatePrecision,
) {
  if (precision === "month") return null
  return parseDateOnly(value)
}

export function isMonthOnlyOpportunityDate(
  precision: OpportunitySourceDatePrecision,
) {
  return precision === "month"
}
