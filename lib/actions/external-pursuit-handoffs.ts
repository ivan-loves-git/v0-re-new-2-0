"use server"

import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"
import { isUuid } from "@/lib/uuid"
import { cleanupExternalLdcStaging, loadVerifiedExternalHandoffContext, retainExternalLdcBytes, stageExternalLdcVersion, type ExternalLdcStage } from "@/lib/external-ldc-version"
import type { ExternalHandoffInput } from "@/lib/external-pursuit-handoff"

/** An attestation of an exchange already completed; this path has no email dependency. */
export async function recordExternalPursuitHandoff(input: ExternalHandoffInput) {
  const staff = await requireStaffAccess()
  if (!isUuid(input.matchId) || !isUuid(input.operationKey) || !input.context
    || !isUuid(input.context.repreneur_id) || !isUuid(input.context.opportunity_id)
    || !isUuid(input.context.cycle_id) || !isUuid(input.context.upstream_id)
    || typeof input.context.is_demo !== "boolean" || !["e4", "e6", "e7"].includes(input.context.handoff_type)
    || !Array.isArray(input.context.documents)
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.exchangeDate)
    || (input.exchangeTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.exchangeTime))
    || !["email", "phone", "meeting", "other"].includes(input.channel)
    || input.reference.trim().length < 5 || input.reference.trim().length > 500) {
    return { success: false as const, message: "Enter the actual date, channel and a meaningful reference." }
  }
  const selection = input.selectionToken
    ? await verifyStaffPortalSelection(input.selectionToken, input.context.repreneur_id, staff.user.id)
    : null
  if (input.selectionToken && !selection) return { success: false as const, message: "The selected staff workspace changed. Refresh and try again." }
  const db = createAdminClient()
  const unavailable = { success: false as const, message: "The current documents, approvals or delivery state changed. Refresh the pursuit before recording. No email was sent." }
  if (input.context.handoff_type === "e4") {
    if (!input.context.ldc) return unavailable
    const { data: replay, error } = await db.rpc("journey_external_ldc_replay", {
      p_operation_key: input.operationKey, p_match_id: input.matchId, p_context: input.context,
      p_exchange_date: input.exchangeDate, p_exchange_time: input.exchangeTime, p_channel: input.channel,
      p_reference: input.reference.trim(), p_staff_user_id: staff.user.id, p_staff_email: staff.user.email,
      p_workspace_id: selection?.workspaceId ?? null, p_workspace_generation: selection?.generation ?? null,
    })
    if (error) return unavailable
    if (typeof replay === "string") return { success: true as const, eventId: replay, message: "External exchange recorded. No email was sent." }
  }
  const current = await loadVerifiedExternalHandoffContext(db, input.matchId, input.context.handoff_type)
  if (!isDeepStrictEqual(current, input.context)) return unavailable
  // Validate retained bytes, without constructing any email attachment or MIME
  // envelope. The database rechecks this same context under its write locks.
  try {
    for (const document of input.context.documents) {
      if (document.storage_bucket !== "opportunity-documents" || typeof document.storage_path !== "string"
        || !document.storage_path.startsWith(`${input.context.opportunity_id}/nda-artifacts/`)
        || typeof document.size_bytes !== "number" || document.size_bytes < 1 || document.size_bytes > 20 * 1024 * 1024
        || typeof document.content_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(document.content_sha256)) return unavailable
      const { data: file, error: fileError } = await db.storage.from("opportunity-documents").download(document.storage_path)
      if (fileError || !file) return unavailable
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.byteLength !== document.size_bytes || createHash("sha256").update(bytes).digest("hex") !== document.content_sha256) return unavailable
    }
  } catch { return unavailable }
  let stage: ExternalLdcStage | undefined
  try {
    if (input.context.handoff_type === "e4") {
      const prepared = await stageExternalLdcVersion(db, input, staff.user)
      stage = prepared.stage
      await retainExternalLdcBytes(db, stage, prepared.bytes, input.context.ldc!.content_sha256!)
    }
    const { data, error } = await db.rpc("journey_record_external_handoff", {
      p_match_id: input.matchId, p_expected_context: input.context,
      p_operation_key: input.operationKey, p_exchange_date: input.exchangeDate,
      p_exchange_time: input.exchangeTime, p_channel: input.channel, p_reference: input.reference.trim(),
      p_staff_user_id: staff.user.id, p_staff_email: staff.user.email,
      p_workspace_id: selection?.workspaceId ?? null, p_workspace_generation: selection?.generation ?? null,
    })
    if (error || typeof data !== "string") throw new Error("External handoff not confirmed")
    revalidatePath(`/opportunities/${input.context.opportunity_id}`)
    revalidatePath("/portal-preview")
    revalidatePath("/portal")
    return { success: true as const, eventId: data, message: "External exchange recorded. No email was sent." }
  } catch { return unavailable }
  finally {
    if (stage && !stage.retained) {
      // The durable claim cannot return a committed/reused object. If lookup
      // fails, leave the owned stage for the bounded cron; never guess/delete.
      try { await cleanupExternalLdcStaging(db, { stageId: stage.stage_id, operationKey: input.operationKey, staffId: staff.user.id }) }
      catch { console.error("External LDC staging cleanup remains pending") }
    }
  }
}
