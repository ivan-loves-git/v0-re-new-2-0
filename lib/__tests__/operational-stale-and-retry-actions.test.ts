import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(),
  sendEmail: vi.fn(),
  deliverNotification: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateRepreneurDashboardTags: mocks.revalidateRepreneurDashboardTags,
  revalidateOpportunityDashboardTags: vi.fn(),
}))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))
vi.mock("@/lib/email/notification-delivery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email/notification-delivery")>()
  return {
    ...original,
    deliverNotification: mocks.deliverNotification,
  }
})

import {
  dropOpportunityPursuit,
  reopenDroppedOpportunityMatch,
  saveOpportunityMatch,
  validateOpportunityPursuit,
} from "@/lib/actions/opportunity-matches"
import { assignOfferToRepreneur, retryOfferReceivedNotification, toggleMilestoneComplete } from "@/lib/actions/offers"

describe("operational stale tabs and retried staff actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.sendEmail.mockResolvedValue({
      success: true,
      resendId: "provider-1",
    })
    mocks.deliverNotification.mockImplementation(async ({ idempotencyKey, send }) => {
      const result = await send(idempotencyKey)
      return result.success === true
        ? { status: "sent", providerId: result.resendId }
        : { status: "failed", error: result.error }
    })
  })

  it("does not overwrite another staff member's newer opportunity recommendation", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "match-1",
        status: "proposed",
        updated_at: "2026-08-21T09:00:00.000Z",
      },
      error: null,
    })
    const repreneurFilter = vi.fn(() => ({ maybeSingle }))
    const opportunityFilter = vi.fn(() => ({ eq: repreneurFilter }))
    const select = vi.fn(() => ({ eq: opportunityFilter }))
    const from = vi.fn(() => ({ select }))
    mocks.createAdminClient.mockReturnValue({ from })

    const formData = new FormData()
    formData.set("opportunity_id", "opportunity-1")
    formData.set("repreneur_id", "repreneur-1")
    formData.set("status", "proposed")
    formData.set("expected_updated_at", "2026-08-21T08:00:00.000Z")

    await expect(saveOpportunityMatch(formData)).resolves.toEqual({
      ok: false,
      message: "This recommendation changed while you were editing it. Refresh to see the latest staff notes.",
    })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it("rejects a forged new match for a free or test client before writing", async () => {
    const from = vi.fn((table: string) => {
      if (table === "opportunity_matches") {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        const repreneurFilter = vi.fn(() => ({ maybeSingle }))
        const opportunityFilter = vi.fn(() => ({ eq: repreneurFilter }))
        return { select: vi.fn(() => ({ eq: opportunityFilter })) }
      }
      if (table === "repreneurs") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: {
            first_name: "Test2Colin",
            last_name: "Repreneur",
            lifecycle_status: "client",
            repreneur_offers: [{ status: "accepted", offer: { name: "End-to-End", price: 0 } }],
          },
          error: null,
        })
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createAdminClient.mockReturnValue({ from })

    const formData = new FormData()
    formData.set("opportunity_id", "opportunity-1")
    formData.set("repreneur_id", "repreneur-1")
    formData.set("status", "proposed")

    await expect(saveOpportunityMatch(formData)).resolves.toEqual({
      ok: false,
      message: "New matches can only be created for accepted paid Deal Flow or End-to-End clients.",
      field: "repreneur_id",
    })
    expect(from).toHaveBeenCalledWith("repreneurs")
  })

  it.each([
    {
      label: "validation",
      current: { id: "match-1", status: "active_pursuit", pursuit_stage: "interest" },
      invoke: () => validateOpportunityPursuit("match-1", "opportunity-1"),
    },
    {
      label: "drop",
      current: { id: "match-1", status: "dropped", pursuit_stage: "dropped" },
      invoke: () => dropOpportunityPursuit("match-1", "opportunity-1"),
    },
    {
      label: "reopen",
      current: { id: "match-1", status: "interested", pursuit_stage: null },
      invoke: () => reopenDroppedOpportunityMatch("match-1", "opportunity-1"),
    },
  ])("treats a lost $label response as success when the requested state is already stored", async ({ current, invoke }) => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "The original request response was lost." },
    })
    const maybeSingle = vi.fn().mockResolvedValue({ data: current, error: null })
    const opportunityFilter = vi.fn(() => ({ maybeSingle }))
    const matchFilter = vi.fn(() => ({ eq: opportunityFilter }))
    const select = vi.fn(() => ({ eq: matchFilter }))
    const from = vi.fn(() => ({ select }))
    mocks.createAdminClient.mockReturnValue({ rpc, from })

    await expect(invoke()).resolves.toBeUndefined()
    expect(matchFilter).toHaveBeenCalledWith("id", "match-1")
    expect(opportunityFilter).toHaveBeenCalledWith("opportunity_id", "opportunity-1")
  })

  it("does not hide a genuinely failed pursuit transition behind another stored state", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Only an interested match can start a pursuit." },
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "match-1", status: "declined", pursuit_stage: null },
      error: null,
    })
    const opportunityFilter = vi.fn(() => ({ maybeSingle }))
    const matchFilter = vi.fn(() => ({ eq: opportunityFilter }))
    const select = vi.fn(() => ({ eq: matchFilter }))
    mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn(() => ({ select })) })

    await expect(validateOpportunityPursuit("match-1", "opportunity-1")).rejects.toThrow(
      "Only an interested match can start a pursuit.",
    )
  })

  it("uses the atomic assignment RPC so an archived offer is rejected by one transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "This offer is no longer active. Refresh before assigning it.",
      },
    })
    mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn() })

    await expect(assignOfferToRepreneur("repreneur-1", "offer-1")).rejects.toThrow(
      "This offer is no longer active. Refresh before assigning it.",
    )
    expect(rpc).toHaveBeenCalledWith("assign_repreneur_offer", {
      p_repreneur_id: "repreneur-1",
      p_offer_id: "offer-1",
      p_created_by: "staff-1",
    })
  })

  it("reports an assigned offer whose notification was rejected and gives the retry a stable provider key", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "assignment-1", error: null })
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() =>
          table === "repreneur_offers"
            ? {
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: "offered" },
                    error: null,
                  }),
                })),
              }
            : {
                single: vi.fn().mockResolvedValue(
                  table === "repreneurs"
                    ? {
                        data: {
                          first_name: "Ada",
                          last_name: "Test",
                          email: "ada@example.test",
                        },
                        error: null,
                      }
                    : { data: { name: "TEST offer" }, error: null },
                ),
              },
        ),
      })),
    }))
    mocks.createAdminClient.mockReturnValue({ rpc, from })
    mocks.sendEmail.mockResolvedValue({
      success: false,
      error: "provider rejected",
    })

    await expect(assignOfferToRepreneur("repreneur-1", "offer-1")).resolves.toEqual({
      success: true,
      assignmentId: "assignment-1",
      notificationSent: false,
      notificationError: "provider rejected",
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "offer-received:assignment-1",
      }),
    )
  })

  it("rejoins an assignment committed before a lost response and retries only its idempotent notification", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "This offer already has an open assignment for this repreneur.",
      },
    })
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "assignment-1" }, error: null })
    const from = vi.fn((table: string) => {
      if (table === "repreneur_offers") {
        return {
          select: vi.fn((fields: string) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() =>
                fields === "id"
                  ? { in: vi.fn(() => ({ maybeSingle })) }
                  : {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { status: "offered" },
                        error: null,
                      }),
                    },
              ),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue(
              table === "repreneurs"
                ? {
                    data: {
                      first_name: "Ada",
                      last_name: "Test",
                      email: "ada@example.test",
                    },
                    error: null,
                  }
                : { data: { name: "TEST offer" }, error: null },
            ),
          })),
        })),
      }
    })
    mocks.createAdminClient.mockReturnValue({ rpc, from })

    await expect(assignOfferToRepreneur("repreneur-1", "offer-1")).resolves.toMatchObject({
      success: true,
      assignmentId: "assignment-1",
      notificationSent: true,
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "offer-received:assignment-1",
      }),
    )
  })

  it("does not send a stale offer notification after the assignment leaves offered", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "assignment-1",
        repreneur_id: "repreneur-1",
        offer_id: "offer-1",
        status: "accepted",
        accepted_at: "2026-08-21T10:00:00.000Z",
        expires_at: null,
        declined_at: null,
        offer: { name: "TEST offer" },
      },
      error: null,
    })
    const secondEq = vi.fn(() => ({ single }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: firstEq })) }))
    mocks.createAdminClient.mockReturnValue({ from })

    await expect(retryOfferReceivedNotification("assignment-1", "repreneur-1")).resolves.toEqual({
      success: false,
      error: "This offer notification is no longer applicable.",
    })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("rechecks offered state after claiming delivery and before calling the provider", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "assignment-1", error: null })
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() =>
          table === "repreneur_offers"
            ? {
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: "accepted" },
                    error: null,
                  }),
                })),
              }
            : {
                single: vi.fn().mockResolvedValue(
                  table === "repreneurs"
                    ? { data: { first_name: "Ada", last_name: "Test", email: "ada@example.test" }, error: null }
                    : { data: { name: "TEST offer" }, error: null },
                ),
              },
        ),
      })),
    }))
    mocks.createAdminClient.mockReturnValue({ rpc, from })

    await expect(assignOfferToRepreneur("repreneur-1", "offer-1")).resolves.toMatchObject({
      success: true,
      assignmentId: "assignment-1",
      notificationSent: false,
      notificationError: "This offer notification is no longer applicable.",
    })
    expect(mocks.deliverNotification).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("does not send a second completion email when a completed milestone request is retried", async () => {
    const ownedMilestoneSingle = vi.fn().mockResolvedValue({
      data: { repreneur_offer: { repreneur_id: "repreneur-1" } },
      error: null,
    })
    const ownedMilestoneSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ single: ownedMilestoneSingle })),
    }))
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn(() => ({ maybeSingle }))
    const completionFilter = vi.fn(() => ({ select }))
    const idFilter = vi.fn(() => ({ eq: completionFilter }))
    const update = vi.fn(() => ({ eq: idFilter }))
    const from = vi.fn().mockReturnValueOnce({ select: ownedMilestoneSelect }).mockReturnValueOnce({ update })
    mocks.createAdminClient.mockReturnValue({ from })

    await toggleMilestoneComplete("milestone-1", "repreneur-1", true)

    expect(completionFilter).toHaveBeenCalledWith("is_completed", false)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("retries an uncertain milestone notification with the same provider key", async () => {
    const firstOwnedMilestoneSingle = vi.fn().mockResolvedValue({
      data: {
        is_completed: false,
        completed_at: null,
        repreneur_offer: { repreneur_id: "repreneur-1" },
      },
      error: null,
    })
    const firstTransition = vi.fn().mockResolvedValue({
      data: { id: "milestone-1", completed_at: "2026-08-21T09:00:00.000Z" },
      error: null,
    })
    const firstSelect = vi.fn(() => ({ maybeSingle: firstTransition }))
    const firstCompletionFilter = vi.fn(() => ({ select: firstSelect }))
    const firstIdFilter = vi.fn(() => ({ eq: firstCompletionFilter }))
    const firstUpdate = vi.fn(() => ({ eq: firstIdFilter }))

    const milestoneSingle = vi.fn().mockResolvedValue({
      data: {
        title: "First meeting",
        repreneur_offer: { offer: { name: "Test offer" } },
      },
      error: null,
    })
    const milestoneSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ single: milestoneSingle })),
    }))
    const repreneurSingle = vi.fn().mockResolvedValue({
      data: { first_name: "Ada", last_name: "Test", email: "ada@example.test" },
      error: null,
    })
    const repreneurSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ single: repreneurSingle })),
    }))

    const retryTransition = vi.fn().mockResolvedValue({ data: null, error: null })
    const retrySelect = vi.fn(() => ({ maybeSingle: retryTransition }))
    const retryCompletionFilter = vi.fn(() => ({ select: retrySelect }))
    const retryIdFilter = vi.fn(() => ({ eq: retryCompletionFilter }))
    const retryUpdate = vi.fn(() => ({ eq: retryIdFilter }))

    const retryOwnedMilestoneSingle = vi.fn().mockResolvedValue({
      data: {
        is_completed: true,
        completed_at: "2026-08-21T09:00:00.000Z",
        repreneur_offer: { repreneur_id: "repreneur-1" },
      },
      error: null,
    })

    const ownedResults = [firstOwnedMilestoneSingle, retryOwnedMilestoneSingle]
    const transitionUpdates = [firstUpdate, retryUpdate]
    let updateNumber = 0
    const from = vi.fn((table: string) => {
      if (table === "repreneurs") return { select: repreneurSelect }
      return {
        select: vi.fn((fields: string) => {
          if (fields === "is_completed, completed_at") {
            return {
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    is_completed: true,
                    completed_at: "2026-08-21T09:00:00.000Z",
                  },
                  error: null,
                }),
              })),
            }
          }
          if (fields.startsWith("title")) return milestoneSelect()
          return {
            eq: vi.fn(() => ({ single: ownedResults.shift()! })),
          }
        }),
        update: vi.fn(() => transitionUpdates[updateNumber++]()),
      }
    })
    mocks.createAdminClient.mockReturnValue({ from })
    mocks.sendEmail.mockResolvedValue({
      success: false,
      error: "provider rejected",
    })

    await expect(toggleMilestoneComplete("milestone-1", "repreneur-1", true)).resolves.toEqual({
      success: true,
      notificationSent: false,
      notificationError: "provider rejected",
    })
    await toggleMilestoneComplete("milestone-1", "repreneur-1", true)

    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendEmail.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      "milestone-completed:milestone-1:2026-08-21T09:00:00.000Z",
      "milestone-completed:milestone-1:2026-08-21T09:00:00.000Z",
    ])
    expect(retryCompletionFilter).toHaveBeenCalledWith("is_completed", false)
  })

  it("creates a new notification event after a milestone is reopened and completed again", async () => {
    vi.useFakeTimers()
    let isCompleted = false
    let completedAt: string | null = null

    const from = vi.fn((table: string) => {
      if (table === "repreneurs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { first_name: "Ada", last_name: "Test", email: "ada@example.test" },
                error: null,
              })),
            })),
          })),
        }
      }

      return {
        select: vi.fn((fields: string) => ({
          eq: vi.fn(() => {
            if (fields.startsWith("title")) {
              return {
                single: vi.fn(async () => ({
                  data: { title: "First meeting", repreneur_offer: { offer: { name: "Test offer" } } },
                  error: null,
                })),
              }
            }
            if (fields === "is_completed, completed_at") {
              return {
                maybeSingle: vi.fn(async () => ({
                  data: { is_completed: isCompleted, completed_at: completedAt },
                  error: null,
                })),
              }
            }
            return {
              single: vi.fn(async () => ({
                data: {
                  is_completed: isCompleted,
                  completed_at: completedAt,
                  repreneur_offer: { repreneur_id: "repreneur-1" },
                },
                error: null,
              })),
            }
          }),
        })),
        update: vi.fn((updates: { is_completed: boolean; completed_at: string | null }) => ({
          eq: vi.fn(() => {
            if (!updates.is_completed) {
              isCompleted = false
              completedAt = null
              return Promise.resolve({ data: null, error: null })
            }
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    if (isCompleted) return { data: null, error: null }
                    isCompleted = true
                    completedAt = updates.completed_at
                    return {
                      data: { id: "milestone-1", completed_at: completedAt },
                      error: null,
                    }
                  }),
                })),
              })),
            }
          }),
        })),
      }
    })
    mocks.createAdminClient.mockReturnValue({ from })

    try {
      vi.setSystemTime(new Date("2026-08-21T09:00:00.000Z"))
      await toggleMilestoneComplete("milestone-1", "repreneur-1", true)
      vi.setSystemTime(new Date("2026-08-21T10:00:00.000Z"))
      await toggleMilestoneComplete("milestone-1", "repreneur-1", false)
      vi.setSystemTime(new Date("2026-08-21T11:00:00.000Z"))
      await toggleMilestoneComplete("milestone-1", "repreneur-1", true)
    } finally {
      vi.useRealTimers()
    }

    expect(mocks.sendEmail.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      "milestone-completed:milestone-1:2026-08-21T09:00:00.000Z",
      "milestone-completed:milestone-1:2026-08-21T11:00:00.000Z",
    ])
  })
})
