"use server"
import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"
import { isUuid } from "@/lib/uuid"
import { RECIPIENT_IM_PAUSED_MESSAGE, recipientImOperationsPaused } from "@/lib/recipient-im-operations"
import { assertSafePdfEvidence } from "@/lib/security/pdf-evidence"
import type { ExternalMemoContext, ExternalMemoInput } from "@/lib/external-memo-approval"

export async function getExternalMemoApprovalContext(matchId: string, documentId: string, expiresAt: string) {
  await requireStaffAccess()
  if (!isUuid(matchId) || !isUuid(documentId) || !Number.isFinite(Date.parse(expiresAt))) return null
  const { data, error } = await createAdminClient().rpc("journey_external_memo_context", {
    p_match_id: matchId, p_document_id: documentId, p_nda_expires_at: new Date(expiresAt).toISOString(),
  })
  return error ? null : data as ExternalMemoContext | null
}

/** Approval and the already external notice share one transaction; this path never prepares email. */
export async function approveMemoWithExternalNotice(input: ExternalMemoInput) {
  const staff = await requireStaffAccess()
  const unavailable = { success: false as const, message: "The current memo, signed copies, approval or notice changed. Refresh before approving. No email was sent." }
  if (!isUuid(input.matchId) || !isUuid(input.operationKey) || !input.context
    || !isUuid(input.context.opportunity_id) || !isUuid(input.context.repreneur_id)
    || !isUuid(input.context.memo?.document_id) || !isUuid(input.context.e7_evidence_id)
    || !Array.isArray(input.context.documents) || input.context.handoff_type !== "e7"
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.exchangeDate)
    || (input.exchangeTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.exchangeTime))
    || !["email", "phone", "meeting", "other"].includes(input.channel)
    || typeof input.reference !== "string" || input.reference.trim().length < 5 || input.reference.trim().length > 500) return unavailable
  const selection = input.selectionToken ? await verifyStaffPortalSelection(input.selectionToken, input.context.repreneur_id, staff.user.id) : null
  if (input.selectionToken && !selection) return unavailable
  const db = createAdminClient()
  const { data: current, error } = await db.rpc("journey_external_memo_context", { p_match_id: input.matchId, p_document_id: input.context.memo.document_id, p_nda_expires_at: input.context.nda_expires_at })
  if (error || !isDeepStrictEqual(current, input.context)) return unavailable
  if (input.context.memo.recipient_match_id && recipientImOperationsPaused()) return { success: false as const, message: RECIPIENT_IM_PAUSED_MESSAGE }
  let memoHash: string | undefined
  try {
    for (const document of [...input.context.documents, input.context.memo]) {
      if (document.storage_bucket !== "opportunity-documents" || !document.storage_path?.startsWith(`${input.context.opportunity_id}/`)
        || !Number.isInteger(document.size_bytes) || document.size_bytes < 1 || document.size_bytes > 20 * 1024 * 1024) return unavailable
      const { data: file, error: downloadError } = await db.storage.from("opportunity-documents").download(document.storage_path)
      if (!file || downloadError) return unavailable
      const bytes = new Uint8Array(await file.arrayBuffer())
      const hash = createHash("sha256").update(bytes).digest("hex")
      if (bytes.byteLength !== document.size_bytes || ("content_sha256" in document && hash !== document.content_sha256)) return unavailable
      if (document === input.context.memo) {
        await assertSafePdfEvidence(bytes)
        memoHash = hash
      }
    }
  } catch { return unavailable }
  if (!memoHash) return unavailable
  const { data, error: recordError } = await db.rpc("journey_approve_memo_external_notice", {
    p_match_id: input.matchId, p_expected_context: input.context, p_memo_sha256: memoHash,
    p_operation_key: input.operationKey, p_exchange_date: input.exchangeDate, p_exchange_time: input.exchangeTime,
    p_channel: input.channel, p_reference: input.reference.trim(), p_staff_user_id: staff.user.id, p_staff_email: staff.user.email,
    p_workspace_id: selection?.workspaceId ?? null, p_workspace_generation: selection?.generation ?? null,
  })
  if (recordError || !isUuid(data)) return unavailable
  revalidatePath(`/opportunities/${input.context.opportunity_id}`)
  revalidatePath("/portal-preview")
  revalidatePath("/portal")
  return { success: true as const, grantId: data, message: "Memo access approved and external notice recorded. No email was sent." }
}
