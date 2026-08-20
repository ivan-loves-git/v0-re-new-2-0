export const DISPLAY_TIME_ZONE = "Europe/Paris"

type DisplayDateOptions = Omit<Intl.DateTimeFormatOptions, "timeZone">

function validDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Formats an instant in Re-New's canonical operating timezone. */
export function formatDisplayDate(
  value: string,
  locale: string,
  options: DisplayDateOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  const date = validDate(value)
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: DISPLAY_TIME_ZONE }).format(date)
}

/** Formats an instant with both date and time in Re-New's canonical operating timezone. */
export function formatDisplayDateTime(
  value: string,
  locale: string,
  options: DisplayDateOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  return formatDisplayDate(value, locale, options)
}

/**
 * Formats a date-only database value as a civil calendar day. It deliberately
 * does not interpret YYYY-MM-DD in the browser's local timezone.
 */
export function formatCivilDate(
  value: string,
  locale: string,
  options: DisplayDateOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return "—"
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return "—"
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date)
}
