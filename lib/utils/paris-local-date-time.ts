const PARIS = "Europe/Paris"

function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`
}

export function parisLocalInputNow(now = new Date()) {
  return parisParts(now)
}

/** A browser's own time zone is never used. Paris civil time can have zero
 * matches during the spring gap and two during the autumn repeated hour. */
export function parisInstantsForLocal(local: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(local)
  if (!match) return []
  const [, year, month, day, hour, minute] = match.map(Number)
  const second = Number(match[6] ?? 0)
  const millisecond = Number((match[7] ?? "0").padEnd(3, "0"))
  const civilAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  if (!Number.isFinite(civilAsUtc)) return []
  const matches = [60, 120]
    .map((offsetMinutes) => new Date(civilAsUtc - offsetMinutes * 60_000))
    .filter((candidate) => parisParts(candidate) ===
      `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${String(second).padStart(2, "0")}`)
    .map((candidate) => candidate.toISOString())
  return [...new Set(matches)].sort()
}
