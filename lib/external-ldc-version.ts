import "server-only"

import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import type { createAdminClient } from "@/lib/supabase/admin"
import type { ExternalHandoffContext } from "@/lib/external-pursuit-handoff"
import { assertSafePdfEvidence } from "@/lib/security/pdf-evidence"
import { isUuid } from "@/lib/uuid"

type Database = ReturnType<typeof createAdminClient>
export const EXTERNAL_LDC_BUCKET = "cvs"

export async function verifiedExternalLdcBytes(db: Database, context: ExternalHandoffContext) {
  const ldc = context.ldc
  if (!ldc || !isUuid(ldc.source_object_id) || !ldc.source_version || !ldc.source_updated_at
    || ldc.mime_type !== "application/pdf" || !ldc.file_name.toLowerCase().endsWith(".pdf")
    || typeof ldc.source_path !== "string" || /(^\/|\\|(^|\/)\.\.?($|\/))/.test(ldc.source_path)
    || !Number.isInteger(ldc.size_bytes) || ldc.size_bytes < 1 || ldc.size_bytes > 20 * 1024 * 1024
    || (ldc.content_sha256 !== null && !/^[0-9a-f]{64}$/.test(ldc.content_sha256))) throw new Error("Current LDC PDF version unavailable")
  const { data: file, error } = await db.storage.from("cvs").download(ldc.source_path)
  if (error || !file) throw new Error("Current LDC bytes unavailable")
  const bytes = new Uint8Array(await file.arrayBuffer())
  const hash = createHash("sha256").update(bytes).digest("hex")
  if (bytes.byteLength !== ldc.size_bytes || (ldc.content_sha256 !== null && ldc.content_sha256 !== hash)) throw new Error("Current LDC bytes changed")
  await assertSafePdfEvidence(bytes)
  return { bytes, context: { ...context, ldc: { ...ldc, content_sha256: hash } } }
}

/** Read-only: no stage, copy or receipt is created merely by opening a panel. */
export async function loadVerifiedExternalHandoffContext(db: Database, matchId: string, handoffType: string) {
  const { data, error } = await db.rpc("journey_external_handoff_context", { p_match_id: matchId, p_handoff_type: handoffType })
  if (error || !data) return null
  const context = data as ExternalHandoffContext
  try { return handoffType === "e4" ? (await verifiedExternalLdcBytes(db, context)).context : context }
  catch { return null }
}

export type ExternalLdcStage = { stage_id: string; storage_path: string; retained: boolean }

export async function stageExternalLdcVersion(db: Database, input: { matchId: string; operationKey: string; context: ExternalHandoffContext }, staff: { id: string; email: string }) {
  // Re-read the source bytes after the staff's version selection. This catches
  // even a changed blob whose metadata/filename still claims the old PDF.
  const verified = await verifiedExternalLdcBytes(db, input.context)
  if (!isDeepStrictEqual(verified.context, input.context)) throw new Error("LDC version selection changed")
  const { data, error } = await db.rpc("journey_stage_external_ldc", { p_match_id: input.matchId,
    p_expected_context: input.context, p_operation_key: input.operationKey, p_staff_user_id: staff.id, p_staff_email: staff.email })
  if (error || !data || !isUuid(data.stage_id) || typeof data.retained !== "boolean"
    || typeof data.storage_path !== "string" || !data.storage_path.startsWith(`pursuit-ldc-evidence/${input.context.repreneur_id}/ldc/`)
    || /(^|\/)\.\.?($|\/)/.test(data.storage_path)) throw new Error("LDC retention stage unavailable")
  const stage = data as ExternalLdcStage
  return { stage, bytes: verified.bytes }
}

export async function retainExternalLdcBytes(db: Database, stage: ExternalLdcStage, bytes: Uint8Array, hash: string) {
  const bucket = db.storage.from(EXTERNAL_LDC_BUCKET)
  if (!stage.retained) {
    const { error } = await bucket.upload(stage.storage_path, bytes, { contentType: "application/pdf", upsert: false, metadata: { sha256: hash } })
    // An identical in-flight retry can have uploaded this own stage first.
    if (error && !["409", "400"].includes(String(error.statusCode))) throw error
  }
  const { data: retained, error } = await bucket.download(stage.storage_path)
  if (error || !retained) throw new Error("Retained LDC bytes unavailable")
  const actual = new Uint8Array(await retained.arrayBuffer())
  if (actual.byteLength !== bytes.byteLength || createHash("sha256").update(actual).digest("hex") !== hash) throw new Error("Retained LDC bytes changed")
}

/** Never delete based on an RPC error or a caller-supplied Storage path. */
export async function cleanupExternalLdcStaging(db: Database, own?: { stageId: string; operationKey: string; staffId: string }) {
  const { data, error } = await db.rpc("journey_claim_ldc_cleanup", { p_stage_id: own?.stageId ?? null,
    p_operation_key: own?.operationKey ?? null, p_staff_user_id: own?.staffId ?? null })
  if (error || !Array.isArray(data)) throw new Error("LDC cleanup eligibility unavailable")
  let deleted = 0
  for (const stage of data) {
    if (!isUuid(stage.id) || stage.state !== "cleanup" || typeof stage.storage_path !== "string"
      || !stage.storage_path.startsWith("pursuit-ldc-evidence/") || !stage.storage_path.endsWith(`/${stage.id}.pdf`) || /(^|\/)\.\.?($|\/)/.test(stage.storage_path)) throw new Error("Invalid owned LDC cleanup path")
    const { error: removeError } = await db.storage.from(EXTERNAL_LDC_BUCKET).remove([stage.storage_path])
    if (removeError && String(removeError.statusCode) !== "404") throw new Error("LDC staging cleanup pending")
    const { error: receiptError } = await db.rpc("journey_complete_ldc_cleanup", { p_stage_id: stage.id })
    if (receiptError) throw new Error("LDC staging cleanup receipt pending")
    deleted++
  }
  return { deleted }
}
