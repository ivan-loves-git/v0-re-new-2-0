import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  requirePortalAccess: vi.fn(),
}))

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requirePortalAccess: mocks.requirePortalAccess }))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({ queueM2RepreneurEvent: vi.fn() }))
vi.mock("@/lib/email/interest-notification-delivery", () => ({
  deliverResponseNotification: vi.fn().mockResolvedValue("sent"),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) =>
      table === "wave_activity_events"
        ? { insert: mocks.insert }
        : { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) },
  }),
}))

import {
  activityRow,
  fieldChanges,
  insertActivity,
  recordActivity,
} from "@/lib/activity/activity-log"
import { declineMyOpportunity } from "@/lib/actions/repreneur-opportunity-responses"
import {
  recordMyOpportunityViewed,
  setMyOpportunityReviewed,
} from "@/lib/actions/repreneur-opportunity-review"

const USER_ID = "user-repreneur-1"
const REPRENEUR_ID = "11111111-1111-4111-8111-111111111111"
const OPPORTUNITY_ID = "22222222-2222-4222-8222-222222222222"
const MATCH_ID = "33333333-3333-4333-8333-333333333333"

/** Runs every callback the code queued for after the response. */
async function flushAfter() {
  for (const [callback] of mocks.after.mock.calls) await callback()
}

function insertedRows() {
  return mocks.insert.mock.calls.map(([row]) => row)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.insert.mockResolvedValue({ error: null })
  mocks.requirePortalAccess.mockResolvedValue({
    user: { id: USER_ID },
    role: "repreneur",
    repreneurId: REPRENEUR_ID,
  })
})

describe("WAVE activity log", () => {
  it("stores who, what, which records and when, dropping ids that are not UUIDs", () => {
    const at = new Date("2026-10-16T10:00:00.000Z")
    expect(
      activityRow(
        {
          action: "portal.deal_opened",
          actorUserId: USER_ID,
          actorRole: "repreneur",
          repreneurId: REPRENEUR_ID,
          opportunityId: "not-a-uuid",
        },
        at,
      ),
    ).toEqual({
      occurred_at: "2026-10-16T10:00:00.000Z",
      action: "portal.deal_opened",
      actor_user_id: USER_ID,
      actor_role: "repreneur",
      repreneur_id: REPRENEUR_ID,
      opportunity_id: null,
      match_id: null,
      details: {},
    })
  })

  it("never lets a failed write undo the person's action", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.insert.mockResolvedValueOnce({ error: { message: "database unavailable" } })
    await expect(
      insertActivity({ action: "auth.signed_in", actorUserId: USER_ID, actorRole: "staff" }),
    ).resolves.toBe(false)
    mocks.insert.mockRejectedValueOnce(new Error("network"))
    await expect(
      insertActivity({ action: "auth.signed_in", actorUserId: USER_ID, actorRole: "staff" }),
    ).resolves.toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it("writes after the response, with the time the action happened", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-16T09:00:00.000Z") })
    expect(
      recordActivity(async () => ({ action: "auth.signed_in", actorUserId: USER_ID, actorRole: "staff" })),
    ).toBe(true)
    expect(mocks.insert).not.toHaveBeenCalled()
    vi.setSystemTime(new Date("2026-10-16T09:00:05.000Z"))
    await flushAfter()
    vi.useRealTimers()
    expect(insertedRows()).toEqual([
      expect.objectContaining({ action: "auth.signed_in", occurred_at: "2026-10-16T09:00:00.000Z" }),
    ])
  })

  it("skips a row whose actor cannot be resolved, and records nothing outside a request", async () => {
    recordActivity(async () => null)
    await flushAfter()
    expect(mocks.insert).not.toHaveBeenCalled()

    mocks.after.mockImplementationOnce(() => {
      throw new Error("after() was called outside a request scope")
    })
    expect(recordActivity({ action: "auth.signed_in", actorUserId: USER_ID, actorRole: "staff" })).toBe(false)
  })

  it("keeps each changed criterion with its old and new value", () => {
    expect(
      fieldChanges(
        { q12_geo_zones: ["IDF"], target_revenue_min_meur: 2, q16_equity: "500k" },
        { q12_geo_zones: ["IDF", "ARA"], target_revenue_min_meur: 2, q16_equity: "1m" },
      ),
    ).toEqual({
      q12_geo_zones: { from: ["IDF"], to: ["IDF", "ARA"] },
      q16_equity: { from: "500k", to: "1m" },
    })
    expect(fieldChanges(null, { target_staff_size_min: 10 })).toEqual({
      target_staff_size_min: { from: null, to: 10 },
    })
  })
})

describe("recorded buyer actions", () => {
  it("records every decline with its reasons, which the match itself overwrites", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: MATCH_ID,
        opportunity_id: OPPORTUNITY_ID,
        status: "proposed",
        opportunity: { status: "active", is_demo: false },
        repreneur: { is_demo: false },
      },
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: [{ opportunity_id: OPPORTUNITY_ID }], error: null })
    const form = new FormData()
    form.append("decline_reason_categories", "geography")
    form.append("decline_reason_categories", "size_metrics")
    form.set("decline_reason_text", "  Too far from Lyon.  ")

    await declineMyOpportunity(MATCH_ID, { status: "idle", message: "" }, form)
    await flushAfter()

    expect(insertedRows()).toContainEqual(
      expect.objectContaining({
        action: "portal.interest_declined",
        actor_user_id: USER_ID,
        actor_role: "repreneur",
        repreneur_id: REPRENEUR_ID,
        opportunity_id: OPPORTUNITY_ID,
        match_id: MATCH_ID,
        details: { reason_categories: ["geography", "size_metrics"], reason_text: "Too far from Lyon." },
      }),
    )
  })

  it("records every visible deal open, but not a reviewed toggle", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ reviewed: false }], error: null })

    await recordMyOpportunityViewed(OPPORTUNITY_ID)
    await recordMyOpportunityViewed(OPPORTUNITY_ID)
    await setMyOpportunityReviewed(OPPORTUNITY_ID, true, false)
    await flushAfter()

    expect(insertedRows().map((row) => [row.action, row.opportunity_id])).toEqual([
      ["portal.deal_opened", OPPORTUNITY_ID],
      ["portal.deal_opened", OPPORTUNITY_ID],
    ])
  })
})
