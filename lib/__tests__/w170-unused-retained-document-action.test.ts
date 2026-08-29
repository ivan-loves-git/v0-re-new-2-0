import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
  remove: vi.fn(),
  pendingRows: [] as Array<{ document_id: string }>,
  from: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTags: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateOpportunityDashboardTags: mocks.revalidateTags }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: () => ({ remove: mocks.remove }) },
  }),
}))

import {
  listPendingUnusedRetainedDocumentCleanups,
  removeUnusedRetainedOpportunityDocument,
} from "@/lib/actions/opportunity-documents"

const request = {
  opportunityId: "00000000-0000-4000-8000-000000000001",
  documentId: "10000000-0000-4000-8000-000000000001",
}

const receipt = [{
  cleanup_id: "20000000-0000-4000-8000-000000000001",
  storage_bucket: "opportunity-documents",
  storage_path: "one/unused.pdf",
}]

describe("W-170 retained-document removal action", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.pendingRows = []
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mocks.pendingRows, error: null }),
        }),
      }),
    }))
    mocks.rpc
      .mockResolvedValueOnce({ data: receipt, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mocks.remove.mockResolvedValue({ error: null })
  })

  it("uses the guarded removal receipt, then clears it only after private Storage succeeds", async () => {
    await expect(removeUnusedRetainedOpportunityDocument(request)).resolves.toEqual({
      success: true,
      message: "Unused retained document removed.",
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "remove_unused_retained_opportunity_document", {
      p_opportunity_id: request.opportunityId,
      p_document_id: request.documentId,
    })
    expect(mocks.remove).toHaveBeenCalledWith(["one/unused.pdf"])
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "complete_unused_retained_opportunity_document_cleanup", {
      p_cleanup_id: receipt[0].cleanup_id,
      p_opportunity_id: request.opportunityId,
    })
  })

  it("reports a truthful retry state when metadata deletion succeeded but private Storage did not", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "storage unavailable" } })

    await expect(removeUnusedRetainedOpportunityDocument(request)).resolves.toEqual({
      success: false,
      message: "Document metadata was removed, but private Storage cleanup is still pending. Retry Remove to finish cleanup.",
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it("projects a pending receipt after refresh and completes that same receipt on retry", async () => {
    mocks.remove.mockResolvedValueOnce({ error: { message: "storage unavailable" } })

    await expect(removeUnusedRetainedOpportunityDocument(request)).resolves.toMatchObject({ success: false })

    mocks.pendingRows = [{ document_id: request.documentId }]
    await expect(listPendingUnusedRetainedDocumentCleanups(request.opportunityId)).resolves.toEqual([
      { documentId: request.documentId },
    ])

    mocks.rpc.mockReset()
    mocks.rpc
      .mockResolvedValueOnce({ data: receipt, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mocks.remove.mockResolvedValue({ error: null })

    await expect(removeUnusedRetainedOpportunityDocument(request)).resolves.toMatchObject({ success: true })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "complete_unused_retained_opportunity_document_cleanup", {
      p_cleanup_id: receipt[0].cleanup_id,
      p_opportunity_id: request.opportunityId,
    })
  })

  it("fails closed before any database call when staff authorization is denied", async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error("Staff access required"))

    await expect(removeUnusedRetainedOpportunityDocument(request)).resolves.toEqual({
      success: false,
      message: "Staff access required",
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
