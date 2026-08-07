import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"

type TestRow = {
  id: string
  opportunity_id?: string
  created_at: string
  [key: string]: unknown
}

function opportunityRow(index: number, createdAt = "2026-08-07T00:00:00.000Z") {
  const id = `opp-${String(index).padStart(4, "0")}`
  return {
    id,
    reference: `REF-${index}`,
    status: "active",
    repreneur_exposure: "staff_only",
    created_at: createdAt,
    updated_at: createdAt,
    source: null,
    source_contacts: [],
    source_office: null,
    office_contacts: [],
  }
}

function keysetClient() {
  let opportunities: TestRow[] = Array.from({ length: 501 }, (_, index) =>
    opportunityRow(index),
  )
  let opportunityPageCount = 0
  const matchIdChunks: string[][] = []

  function builderFor(table: string) {
    const state = {
      selected: "",
      filters: [] as Array<{ kind: "lte" | "gt"; column: string; value: string }>,
      inIds: [] as string[],
      limit: Number.POSITIVE_INFINITY,
      ascending: true,
    }
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn((selected: string) => {
      state.selected = selected
      return builder
    })
    builder.lte = vi.fn((column: string, value: string) => {
      state.filters.push({ kind: "lte", column, value })
      return builder
    })
    builder.gt = vi.fn((column: string, value: string) => {
      state.filters.push({ kind: "gt", column, value })
      return builder
    })
    builder.in = vi.fn((_column: string, values: string[]) => {
      state.inIds = values
      return builder
    })
    builder.order = vi.fn((_column: string, options?: { ascending?: boolean }) => {
      state.ascending = options?.ascending !== false
      return builder
    })
    builder.limit = vi.fn((limit: number) => {
      state.limit = limit
      return builder
    })

    function filtered(rows: TestRow[]) {
      return rows
        .filter((row) => state.filters.every((filter) => {
          const value = String(row[filter.column] ?? "")
          return filter.kind === "lte"
            ? value <= filter.value
            : value > filter.value
        }))
        .sort((left, right) =>
          state.ascending
            ? left.id.localeCompare(right.id)
            : right.id.localeCompare(left.id),
        )
        .slice(0, state.limit)
    }

    async function execute() {
      if (table === "opportunities") {
        const page = filtered(opportunities)
        if (state.selected !== "id") {
          opportunityPageCount += 1
          if (opportunityPageCount === 1) {
            // Offset pagination would skip a later row after this deletion.
            opportunities = opportunities.filter((row) => row.id !== "opp-0001")
            // This insert sorts before the cursor but is outside the snapshot.
            opportunities.push({
              ...opportunityRow(250, "9999-01-01T00:00:00.000Z"),
              id: "opp-0250a",
            })
          }
        }
        return { data: page, error: null }
      }
      if (table === "opportunity_matches") {
        matchIdChunks.push([...state.inIds])
        return { data: [], error: null }
      }
      throw new Error(`Unexpected table ${table}`)
    }

    builder.maybeSingle = vi.fn(async () => {
      const result = await execute()
      return { data: result.data[0] ?? null, error: result.error }
    })
    builder.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => execute().then(resolve, reject)
    return builder
  }

  const from = vi.fn((table: string) => builderFor(table))
  return { client: { from }, matchIdChunks }
}

describe("W-074 opportunity export keyset reads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "qa-staff" } })
  })

  it("crosses the page boundary once without offset drift or concurrent inserts", async () => {
    const { client, matchIdChunks } = keysetClient()
    mocks.createAdminClient.mockReturnValue(client)

    const rows = await listOpportunityWorkSurfaceRecords({
      includeSourceReview: false,
    })

    expect(rows).toHaveLength(501)
    expect(new Set(rows.map((row) => row.id)).size).toBe(501)
    expect(rows.at(-1)?.id).toBe("opp-0500")
    expect(rows.some((row) => row.id === "opp-0250a")).toBe(false)
    expect(matchIdChunks.length).toBe(6)
    expect(matchIdChunks.every((chunk) => chunk.length <= 100)).toBe(true)
  })
})
