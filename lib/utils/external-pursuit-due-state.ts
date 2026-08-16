/**
 * The dossier stores a civil date, not a timestamp.  Compare it to a civil
 * Paris date so an operator near midnight is never shown a UTC-derived state.
 */
export type ExternalPursuitDueState = "no_date" | "due_today" | "upcoming" | "overdue"

export function parisDateKey(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function externalPursuitDueState(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): ExternalPursuitDueState {
  if (!dueAt || !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return "no_date"
  const today = parisDateKey(now)
  if (dueAt < today) return "overdue"
  if (dueAt === today) return "due_today"
  return "upcoming"
}

export function externalPursuitDueStateLabel(state: ExternalPursuitDueState) {
  switch (state) {
    case "due_today":
      return "Due today"
    case "upcoming":
      return "Upcoming"
    case "overdue":
      return "Overdue"
    default:
      return "No due date"
  }
}
