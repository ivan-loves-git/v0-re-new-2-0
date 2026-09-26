import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { processRecipientImCleanup } from "@/lib/recipient-im-cleanup"

const opportunityId = "00000000-0000-4000-8000-000000000010"
const matchId = "00000000-0000-4000-8000-000000000011"
const documentId = "00000000-0000-4000-8000-000000000012"
const path = `${opportunityId}/recipient-im/${matchId}/private.pdf`

describe("recipient IM private cleanup", () => {
  beforeEach(() => vi.clearAllMocks())

  it("records failure without a deletion receipt, then retries only the same bound object", async () => {
    const remove = vi.fn()
      .mockResolvedValueOnce({ error: { message: "storage unavailable" } })
      .mockResolvedValueOnce({ error: null })
    const rpc = vi.fn()
    const row = { document_id: documentId, opportunity_id: opportunityId, match_id: matchId,
      storage_bucket: "opportunity-documents", storage_path: path, status: "pending" }
    let remaining = 1
    rpc.mockImplementationOnce(async () => ({ data: "failed", error: null }))
      .mockImplementationOnce(async () => { remaining = 0; return { data: "deleted", error: null } })
    mocks.createAdminClient.mockReturnValue({
      from: (table: string) => {
        expect(table).toBe("recipient_im_cleanup")
        const query = { eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [row], error: null }) }
        return { select: (_columns: string, options?: { head?: boolean }) => options?.head
          ? Object.assign(Promise.resolve({ count: remaining, error: null }), { eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis() })
          : query }
      },
      storage: { from: (bucket: string) => {
        expect(bucket).toBe("opportunity-documents")
        return { remove }
      } },
      rpc,
    })

    expect(await processRecipientImCleanup({ matchId })).toEqual({ examined: 1, deleted: 0, failed: 1, remaining: 1 })
    expect(rpc).toHaveBeenCalledWith("record_recipient_im_cleanup_attempt", {
      p_document_id: documentId, p_result: "failed", p_error_code: "storage_remove_failed",
    })
    expect(await processRecipientImCleanup({ matchId })).toEqual({ examined: 1, deleted: 1, failed: 0, remaining: 0 })
    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenNthCalledWith(1, [path])
    expect(remove).toHaveBeenNthCalledWith(2, [path])
    expect(rpc).toHaveBeenLastCalledWith("record_recipient_im_cleanup_attempt", {
      p_document_id: documentId, p_result: "deleted", p_error_code: null,
    })
  })
})
