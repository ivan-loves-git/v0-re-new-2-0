import { describe, expect, it, vi } from "vitest"
import { readCompleteLedgerPages } from "@/lib/ai/ledger-pagination"

const key = (row: { id: string }) => row.id

describe("exact bounded ledger pagination", () => {
  it("reads every exact-count page with stable ranges", async () => {
    const fetchPage = vi.fn(async (from: number, through: number) => ({
      data: [{ id: "a" }, { id: "b" }, { id: "c" }].slice(from, through + 1), count: 3, error: null,
    }))
    const result = await readCompleteLedgerPages({ fetchPage, key, cap: 5, pageSize: 2 })
    expect(result).toEqual({ state: "complete", rows: [{ id: "a" }, { id: "b" }, { id: "c" }] })
    expect(fetchPage.mock.calls).toEqual([[0, 1], [2, 3]])
  })

  it("returns an exact empty cohort without confusing zero with missing", async () => {
    const result = await readCompleteLedgerPages({
      fetchPage: async () => ({ data: [], count: 0, error: null }), key, cap: 5, pageSize: 2,
    })
    expect(result).toEqual({ state: "complete", rows: [] })
  })

  it("marks absent counts, caps, changed pages, duplicates and errors incomplete", async () => {
    const base = { key, cap: 2, pageSize: 2 }
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: [], count: null, error: null }),
    })).toEqual({ state: "incomplete", reason: "count_unavailable" })
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: [], count: 3, error: null }),
    })).toEqual({ state: "incomplete", reason: "row_cap" })
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: [{ id: "a" }], count: 2, error: null }),
    })).toEqual({ state: "incomplete", reason: "page_changed" })
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: [{ id: "a" }, { id: "a" }], count: 2, error: null }),
    })).toEqual({ state: "incomplete", reason: "page_changed" })
    expect(await readCompleteLedgerPages({ ...base,
      fetchPage: async () => ({ data: null, count: null, error: new Error("private") }),
    })).toEqual({ state: "incomplete", reason: "read_failed" })
  })

  it("rejects a count changing after the first page", async () => {
    let page = 0
    const result = await readCompleteLedgerPages({ key, cap: 10, pageSize: 2,
      fetchPage: async () => {
        page += 1
        return page === 1
          ? { data: [{ id: "a" }, { id: "b" }], count: 3, error: null }
          : { data: [{ id: "c" }], count: 4, error: null }
      },
    })
    expect(result).toEqual({ state: "incomplete", reason: "page_changed" })
  })
})
