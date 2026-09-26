import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({
  staff: vi.fn(async () => ({})),
  client: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: boundary.client }))

import { getMaOpportunityInteractionHistory } from "@/lib/ma-workflows"

describe("staff opportunity interaction history read", () => {
  beforeEach(() => {
    boundary.staff.mockClear()
    boundary.client.mockReset()
  })

  it("pages past the former latest-eight window and joins each event to its original office", async () => {
    const rows = [
      ...Array.from({ length: 200 }, (_, index) => ({
        id: `new-${index}`,
        opportunity_id: "synthetic-opportunity",
        office_id: "current-office",
        channel: "email",
        direction: "outbound",
        title: `Recent ${index}`,
        delivery_status: "sent",
        occurred_at: "2026-09-02T12:00:00Z",
        created_at: "2026-09-02T12:00:00Z",
      })),
      {
        id: "old-sent-event",
        opportunity_id: "synthetic-opportunity",
        office_id: "original-office",
        channel: "email",
        direction: "outbound",
        title: "Retained old-office send",
        recipient_email_snapshot: "original@example.test",
        delivery_status: "sent",
        occurred_at: "2026-09-01T12:00:00Z",
        created_at: "2026-09-01T12:00:00Z",
      },
    ]
    const ranges: Array<[number, number]> = []
    const orders: string[] = []
    const requestedOffices: string[][] = []
    const from = vi.fn((table: string) => {
      if (table === "ma_interactions") {
        const query = {
          order(column: string) {
            orders.push(column)
            return query
          },
          async range(start: number, end: number) {
            ranges.push([start, end])
            return { data: rows.slice(start, end + 1), error: null }
          },
        }
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              expect([column, value]).toEqual(["opportunity_id", "synthetic-opportunity"])
              return query
            },
          }),
        }
      }
      if (table === "ma_offices") {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => {
              requestedOffices.push(ids)
              return {
                data: [
                  { id: "current-office", name: "Current office", firm_id: "current-firm" },
                  { id: "original-office", name: "Original office", firm_id: "original-firm" },
                ],
                error: null,
              }
            },
          }),
        }
      }
      if (table === "ma_firms") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: "current-firm", name: "Current firm" },
                { id: "original-firm", name: "Original firm" },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    boundary.client.mockReturnValue({ from })

    const history = await getMaOpportunityInteractionHistory("synthetic-opportunity")

    expect(boundary.staff).toHaveBeenCalledOnce()
    expect(ranges).toEqual([[0, 199], [200, 399]])
    expect(orders).toEqual(["occurred_at", "id", "occurred_at", "id"])
    expect(requestedOffices).toEqual([["current-office", "original-office"]])
    expect(history).toHaveLength(201)
    expect(history[200]).toMatchObject({
      id: "old-sent-event",
      original_office_name: "Original office",
      original_firm_name: "Original firm",
      recipient_email: "original@example.test",
      status: "sent",
    })
  })
})
