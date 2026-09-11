const PARIS_TIME_ZONE = "Europe/Paris"

function parisCivilDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value))
  const read = (type: string) => parts.find((part) => part.type === type)?.value
  return `${read("year")}-${read("month")}-${read("day")}`
}

export function addParisBusinessDays(sentAt: string | Date, days: number) {
  const [year, month, day] = parisCivilDate(sentAt).split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  let remaining = days
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    const weekday = date.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return date.toISOString().slice(0, 10)
}

export function bookingReminderDueOn(sentAt: string | Date) {
  return addParisBusinessDays(sentAt, 5)
}

export function isBookingReminderDue(sentAt: string | Date, now: string | Date) {
  return bookingReminderDueOn(sentAt) <= parisCivilDate(now)
}
