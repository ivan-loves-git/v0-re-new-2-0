import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  readMaRelationshipLedger: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/data/ma-relationship-ledger", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/data/ma-relationship-ledger")>()
  return { ...actual, readMaRelationshipLedger: mocks.readMaRelationshipLedger }
})

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { getMaFirmWorkspace } from "@/lib/actions/ma-relationship-workspaces"
import { listMaRelationshipTimeline } from "@/lib/actions/ma-relationships"
import type { MaRelationshipLedgerActivity } from "@/lib/data/ma-relationship-ledger"

const activity = {
  id: "activity-1",
  officeId: "office-1",
} as MaRelationshipLedgerActivity

describe("W-103 global relationship timeline ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.readMaRelationshipLedger.mockResolvedValue({ activities: [activity] })
  })

  it("reads filtered timeline activity through the canonical ledger", async () => {
    const result = await listMaRelationshipTimeline({
      officeId: "office-1",
      affiliationId: "affiliation-1",
      opportunityId: "opportunity-1",
      limit: 12,
    })

    expect(mocks.readMaRelationshipLedger).toHaveBeenCalledWith({
      purpose: "timeline",
      officeId: "office-1",
      affiliationId: "affiliation-1",
      opportunityId: "opportunity-1",
      interactionLimit: 12,
    })
    expect(result).toEqual([activity])
  })

  it("keeps firm activity ordered by occurredAt DESC, then id DESC", async () => {
    const sameTime = "2026-08-18T08:00:00.000Z"
    const activityFor = (id: string, officeId: string, occurredAt: string) =>
      ({
        ...activity,
        id,
        officeId,
        occurredAt,
        channel: "call",
        title: null,
        activityProvenance: "manual",
        deliveryStatus: null,
        providerIdempotencyKey: null,
        providerMessageId: null,
        deliveryFinalizedAt: null,
        sentAt: null,
        opportunityId: null,
        opportunityLabel: null,
      }) as MaRelationshipLedgerActivity
    const rows = {
      a: activityFor("activity-a", "office-a", sameTime),
      b: activityFor("activity-b", "office-b", sameTime),
      c: activityFor("activity-c", "office-a", "2026-08-19T08:00:00.000Z"),
    }
    mocks.readMaRelationshipLedger.mockResolvedValue({
      affiliations: [],
      opportunities: [],
      activities: [rows.c, rows.b, rows.a],
      affiliationsByOffice: new Map(),
      opportunitiesByOffice: new Map(),
      activitiesByOffice: new Map([
        ["office-a", [rows.a, rows.c]],
        ["office-b", [rows.b]],
      ]),
      activePursuitOpportunityIds: new Set(),
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "firm-1",
        name: "Atlas Advisory",
        status: "active",
        internal_notes: null,
        created_at: null,
        updated_at: null,
        updated_by: null,
        offices: [
          {
            id: "office-a",
            name: "Paris",
            city: "Paris",
            status: "active",
            is_default: true,
          },
          {
            id: "office-b",
            name: "London",
            city: "London",
            status: "active",
            is_default: false,
          },
        ],
      },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    })

    const workspace = await getMaFirmWorkspace("firm-1")

    expect(workspace?.activity.map(({ id }) => id)).toEqual([
      "activity-c",
      "activity-b",
      "activity-a",
    ])
    expect(mocks.readMaRelationshipLedger).toHaveBeenCalledWith({
      purpose: "detail",
      officeIds: ["office-a", "office-b"],
    })
  })
})
