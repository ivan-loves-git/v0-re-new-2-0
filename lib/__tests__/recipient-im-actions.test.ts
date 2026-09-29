import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  processRecipientImCleanup: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/recipient-im-cleanup", () => ({ processRecipientImCleanup: mocks.processRecipientImCleanup }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateOpportunityDashboardTags: vi.fn() }))

import { retryRecipientImCleanup, setOpportunityRecipientImRequired } from "@/lib/actions/opportunity-documents"

const opportunityId = "00000000-0000-4000-8000-000000000010"
const documentId = "00000000-0000-4000-8000-000000000012"

function cleanupReadbacks(statuses: Array<"pending" | "failed" | "deleted">) {
  const maybeSingle = vi.fn()
  for (const status of statuses) maybeSingle.mockResolvedValueOnce({ data: {
    document_id: documentId, status,
    deletion_receipt_at: status === "deleted" ? "2026-09-26T19:00:00.000Z" : null,
  }, error: null })
  const secondEq = vi.fn(() => ({ maybeSingle }))
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: firstEq })) }))
  mocks.createAdminClient.mockReturnValue({ from })
  return { from, maybeSingle }
}

describe("recipient IM cleanup staff retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("pauses new personalized handling but still permits switching an opportunity back to reusable", async () => {
    vi.stubEnv("RECIPIENT_IM_OPERATIONS_DISABLED", "1")
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(setOpportunityRecipientImRequired(opportunityId, true)).resolves.toEqual({
      success: false,
      message: "Recipient-specific IM operations are temporarily paused.",
    })
    expect(rpc).not.toHaveBeenCalled()
    await expect(setOpportunityRecipientImRequired(opportunityId, false)).resolves.toMatchObject({ success: true })
  })

  it("confirms the durable deletion receipt when a stale page retries after cron finished", async () => {
    cleanupReadbacks(["deleted", "deleted"])

    await expect(retryRecipientImCleanup(opportunityId, documentId)).resolves.toEqual({
      success: true,
      message: "Exact private IM deletion confirmed.",
    })
    expect(mocks.processRecipientImCleanup).not.toHaveBeenCalled()
  })

  it("confirms the durable receipt when cron finishes while the staff retry is in flight", async () => {
    const { maybeSingle } = cleanupReadbacks(["pending", "deleted"])
    mocks.processRecipientImCleanup.mockResolvedValue({ examined: 0, deleted: 0, failed: 0, remaining: 0 })

    await expect(retryRecipientImCleanup(opportunityId, documentId)).resolves.toEqual({
      success: true,
      message: "Exact private IM deletion confirmed.",
    })
    expect(maybeSingle).toHaveBeenCalledTimes(2)
    expect(mocks.processRecipientImCleanup).toHaveBeenCalledWith({ opportunityId, documentId, limit: 1 })
  })

  it("still confirms a concurrent cron receipt when this worker reports an error", async () => {
    cleanupReadbacks(["pending", "deleted"])
    mocks.processRecipientImCleanup.mockRejectedValue(new Error("transient storage error"))

    await expect(retryRecipientImCleanup(opportunityId, documentId)).resolves.toEqual({
      success: true,
      message: "Exact private IM deletion confirmed.",
    })
  })
})
