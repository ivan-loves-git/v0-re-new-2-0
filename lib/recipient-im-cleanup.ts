import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { recipientImOperationsPaused } from "@/lib/recipient-im-operations"

export type RecipientImCleanupResult = { examined: number; deleted: number; failed: number; remaining: number }

type CleanupRow = {
  document_id: string
  opportunity_id: string
  match_id: string
  storage_bucket: string
  storage_path: string
  status: "pending" | "failed" | "deleted"
}

/** Storage is outside the SQL transaction. A committed Drop denies every app
 * route first; this worker removes only its immutable exact-path object and
 * records a deletion receipt only after Storage confirms the operation. */
export async function processRecipientImCleanup(input: {
  matchId?: string
  opportunityId?: string
  documentId?: string
  limit?: number
} = {}): Promise<RecipientImCleanupResult> {
  const supabase = createAdminClient()
  const result = { examined: 0, deleted: 0, failed: 0, remaining: 0 }
  if (!recipientImOperationsPaused()) {
    let query = supabase.from("recipient_im_cleanup")
      .select("document_id,opportunity_id,match_id,storage_bucket,storage_path,status")
      .neq("status", "deleted")
    if (input.matchId) query = query.eq("match_id", input.matchId)
    if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId)
    if (input.documentId) query = query.eq("document_id", input.documentId)
    const { data, error } = await query.order("dropped_at", { ascending: true })
      .limit(Math.max(1, Math.min(25, input.limit ?? 25)))
    if (error) throw new Error("Recipient IM cleanup queue could not be read.")

    for (const row of (data ?? []) as CleanupRow[]) {
      result.examined++
      const exactPrefix = `${row.opportunity_id}/recipient-im/${row.match_id}/`
      const exactTarget = row.storage_bucket === "opportunity-documents"
        && row.storage_path.startsWith(exactPrefix)
        && row.storage_path.length > exactPrefix.length
        && !/(^|\/)\.\.?($|\/)/.test(row.storage_path)
      const { error: storageError } = exactTarget
        ? await supabase.storage.from("opportunity-documents").remove([row.storage_path])
        : { error: new Error("invalid_exact_target") }
      const outcome = storageError ? "failed" : "deleted"
      const { data: recorded, error: receiptError } = await supabase.rpc(
        "record_recipient_im_cleanup_attempt",
        {
          p_document_id: row.document_id,
          p_result: outcome,
          p_error_code: storageError ? (exactTarget ? "storage_remove_failed" : "invalid_exact_target") : null,
        },
      )
      if (receiptError || recorded !== outcome) {
        // Never claim physical deletion without its durable SQL receipt.
        result.failed++
        continue
      }
      if (outcome === "deleted") result.deleted++
      else result.failed++
    }
  }
  let remainingQuery = supabase.from("recipient_im_cleanup")
    .select("document_id", { count: "exact", head: true }).neq("status", "deleted")
  if (input.matchId) remainingQuery = remainingQuery.eq("match_id", input.matchId)
  if (input.opportunityId) remainingQuery = remainingQuery.eq("opportunity_id", input.opportunityId)
  if (input.documentId) remainingQuery = remainingQuery.eq("document_id", input.documentId)
  const { count, error: countError } = await remainingQuery
  if (countError || count === null) throw new Error("Recipient IM cleanup receipt count could not be read.")
  result.remaining = count
  return result
}
