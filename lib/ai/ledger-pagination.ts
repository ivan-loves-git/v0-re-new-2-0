/** A complete, exact-count read or an explicit incomplete result. */
export type LedgerIncompleteReason = "read_failed" | "count_unavailable" | "row_cap" | "page_changed"

export type LedgerPageResult<T> =
  | { state: "complete"; rows: T[] }
  | { state: "incomplete"; reason: LedgerIncompleteReason }

type Page<T> = { data: T[] | null; count: number | null; error: unknown }

export async function readCompleteLedgerPages<T>(input: {
  fetchPage: (from: number, through: number) => Promise<Page<T>>
  key: (row: T) => string
  cap: number
  pageSize: number
}): Promise<LedgerPageResult<T>> {
  const rows: T[] = []
  const keys = new Set<string>()
  let total: number | null = null
  for (let offset = 0; ; offset += input.pageSize) {
    let page: Page<T>
    try {
      page = await input.fetchPage(offset, offset + input.pageSize - 1)
    } catch {
      return { state: "incomplete", reason: "read_failed" }
    }
    if (page.error) return { state: "incomplete", reason: "read_failed" }
    if (!Number.isSafeInteger(page.count) || page.count === null || page.count < 0) {
      return { state: "incomplete", reason: "count_unavailable" }
    }
    if (total !== null && page.count !== total) return { state: "incomplete", reason: "page_changed" }
    total = page.count
    if (total > input.cap) return { state: "incomplete", reason: "row_cap" }
    const expected = Math.min(input.pageSize, total - offset)
    if (!Array.isArray(page.data) || page.data.length !== expected) {
      return { state: "incomplete", reason: "page_changed" }
    }
    for (const row of page.data) {
      const key = input.key(row)
      if (!key || keys.has(key)) return { state: "incomplete", reason: "page_changed" }
      keys.add(key)
      rows.push(row)
    }
    if (rows.length === total) return { state: "complete", rows }
  }
}
