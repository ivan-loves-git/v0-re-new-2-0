/** A complete, exact-count read or an explicit incomplete result. */
export type LedgerIncompleteReason = "read_failed" | "count_unavailable" | "row_cap" | "page_changed"

export type LedgerPageResult<T> =
  | { state: "complete"; rows: T[] }
  | { state: "incomplete"; reason: LedgerIncompleteReason }

type Page<T> = { data: T[] | null; count: number | null; error: unknown }

export async function readCompleteLedgerPages<T>(input: {
  fetchPage: (after: T | null, limit: number) => Promise<Page<T>>
  key: (row: T) => string
  compare: (before: T, after: T) => number
  cap: number
  pageSize: number
}): Promise<LedgerPageResult<T>> {
  const rows: T[] = []
  const keys = new Set<string>()
  let total: number | null = null
  let cursor: T | null = null
  for (;;) {
    let page: Page<T>
    try {
      page = await input.fetchPage(cursor, input.pageSize)
    } catch {
      return { state: "incomplete", reason: "read_failed" }
    }
    if (page.error) return { state: "incomplete", reason: "read_failed" }
    if (!Number.isSafeInteger(page.count) || page.count === null || page.count < 0) {
      return { state: "incomplete", reason: "count_unavailable" }
    }
    if (total !== null && page.count !== total - rows.length) return { state: "incomplete", reason: "page_changed" }
    total ??= page.count
    if (total > input.cap) return { state: "incomplete", reason: "row_cap" }
    const expected = Math.min(input.pageSize, page.count)
    if (!Array.isArray(page.data) || page.data.length !== expected) {
      return { state: "incomplete", reason: "page_changed" }
    }
    for (const row of page.data) {
      const key = input.key(row)
      if (!key || keys.has(key)) return { state: "incomplete", reason: "page_changed" }
      if (cursor !== null) {
        const order = input.compare(cursor, row)
        if (!Number.isFinite(order) || order >= 0) return { state: "incomplete", reason: "page_changed" }
      }
      keys.add(key)
      rows.push(row)
      cursor = row
    }
    if (rows.length === total) {
      // Recount the full cohort after cursor traversal, including deletion behind
      // the cursor. A zero-row query returns the exact count, not more metadata.
      let final: Page<T>
      try { final = await input.fetchPage(null, 0) } catch {
        return { state: "incomplete", reason: "read_failed" }
      }
      if (final.error) return { state: "incomplete", reason: "read_failed" }
      if (!Number.isSafeInteger(final.count) || final.count === null || final.count < 0) {
        return { state: "incomplete", reason: "count_unavailable" }
      }
      if (final.count !== total || !Array.isArray(final.data) || final.data.length !== 0) {
        return { state: "incomplete", reason: "page_changed" }
      }
      return { state: "complete", rows }
    }
  }
}

export const LEDGER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEDGER_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/

/** Cursor values originate in metadata rows; validate before PostgREST syntax. */
export function ledgerKeysetFilter(timeField: "started_at" | "occurred_at", idField: "generation_id" | "id", timestamp: string, id: string) {
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time) || !LEDGER_TIMESTAMP.test(timestamp) || !LEDGER_UUID.test(id)) throw new Error("Invalid ledger cursor")
  // PostgreSQL timestamps can contain microseconds: ISO conversion via Date
  // would truncate them and include the last row again on the following page.
  const instant = timestamp.replace(" ", "T")
  return `${timeField}.gt.${instant},and(${timeField}.eq.${instant},${idField}.gt.${id.toLowerCase()})`
}

export function compareLedgerCursor(aTime: string, aId: string, bTime: string, bId: string) {
  const a = LEDGER_TIMESTAMP.exec(aTime), b = LEDGER_TIMESTAMP.exec(bTime)
  const aMillis = Date.parse(aTime), bMillis = Date.parse(bTime)
  if (!a || !b || !Number.isFinite(aMillis) || !Number.isFinite(bMillis)) return Number.NaN
  const aMicros = BigInt(aMillis) * BigInt(1000) + BigInt((a[1] ?? "").padEnd(6, "0").slice(3))
  const bMicros = BigInt(bMillis) * BigInt(1000) + BigInt((b[1] ?? "").padEnd(6, "0").slice(3))
  if (aMicros !== bMicros) return aMicros < bMicros ? -1 : 1
  return aId < bId ? -1 : aId > bId ? 1 : 0
}
