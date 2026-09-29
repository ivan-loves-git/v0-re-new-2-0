import { describe, expect, it, vi } from "vitest"
import { readCompleteLedgerPages, ledgerKeysetFilter, compareLedgerCursor } from "@/lib/ai/ledger-pagination"

type Row = { id: string }
const key = (row: Row) => row.id
const compare = (a: Row, b: Row) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
const base = { key, compare, cap: 5, pageSize: 2 }

describe("exact bounded keyset ledger pagination", () => {
  it("traverses after the last stable key and recounts the whole cohort", async () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const fetchPage = vi.fn(async (after: Row | null, limit: number) => {
      const remaining = rows.filter(row => !after || row.id > after.id)
      return { data: remaining.slice(0, limit), count: remaining.length, error: null }
    })
    expect(await readCompleteLedgerPages({ ...base, fetchPage })).toEqual({ state: "complete", rows })
    expect(fetchPage.mock.calls).toEqual([[null, 2], [{ id: "b" }, 2], [null, 0]])
  })

  it("returns an exact empty cohort without confusing zero with missing", async () => {
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: [], count: 0, error: null }),
    })).toEqual({ state: "complete", rows: [] })
  })

  it("withholds absent counts, oversized cohorts, short pages, duplicates and read errors", async () => {
    for (const [page, reason] of [
      [{ data: [], count: null, error: null }, "count_unavailable"],
      [{ data: [], count: 6, error: null }, "row_cap"],
      [{ data: [{ id: "a" }], count: 2, error: null }, "page_changed"],
      [{ data: [{ id: "a" }, { id: "a" }], count: 2, error: null }, "page_changed"],
      [{ data: null, count: null, error: new Error("private") }, "read_failed"],
    ] as const) {
      expect(await readCompleteLedgerPages({ ...base, fetchPage: async () => ({...page, data: page.data && [...page.data]}) }))
        .toEqual({ state: "incomplete", reason })
    }
  })

  it("rejects a changing boundary instead of silently skipping a removed row", async () => {
    let page = 0
    expect(await readCompleteLedgerPages({ ...base, fetchPage: async () => {
      page += 1
      return page === 1
        ? { data: [{ id: "a" }, { id: "b" }], count: 4, error: null }
        : { data: [{ id: "d" }], count: 1, error: null }
    } })).toEqual({ state: "incomplete", reason: "page_changed" })
  })

  it("detects deletion behind the cursor through the final full-count read", async () => {
    let page = 0
    expect(await readCompleteLedgerPages({ ...base, fetchPage: async () => {
      page += 1
      if (page === 1) return { data: [{ id: "a" }, { id: "b" }], count: 3, error: null }
      if (page === 2) return { data: [{ id: "c" }], count: 1, error: null }
      return { data: [], count: 2, error: null }
    } })).toEqual({ state: "incomplete", reason: "page_changed" })
  })

  it("rejects a backwards page even with distinct identities and an exact count", async () => {
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: [{ id: "b" }, { id: "a" }], count: 2, error: null }),
    })).toEqual({ state: "incomplete", reason: "page_changed" })
  })

  it("preserves PostgreSQL microseconds and validates cursor filter values", () => {
    const id = "00000000-0000-4000-8000-000000000001"
    expect(ledgerKeysetFilter("started_at", "generation_id", "2026-09-25T16:57:00.123456+00:00", id))
      .toContain("started_at.eq.2026-09-25T16:57:00.123456+00:00")
    expect(compareLedgerCursor("2026-09-25T16:57:00.123455Z", "z", "2026-09-25T16:57:00.123456Z", "a")).toBe(-1)
    expect(compareLedgerCursor("2026-09-25T16:57:00.123456Z", "a", "2026-09-25T16:57:00.123456Z", "b")).toBe(-1)
    expect(() => ledgerKeysetFilter("occurred_at", "id", "invalid),id.gt.any", id)).toThrow("Invalid ledger cursor")
    expect(() => ledgerKeysetFilter("occurred_at", "id", "2026-09-25T16:57:00Z", "bad),id.gt.any")).toThrow("Invalid ledger cursor")
  })
})
