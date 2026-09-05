import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ResendDeliveryRequest } from "@/lib/email/resend-delivery-outcome"
import { assertExactPursuitAttachments, type PursuitSignedCopy } from "@/lib/pursuit-handoff-attachments"

type Admin = ReturnType<typeof createAdminClient>
export type HandoffType = "e4" | "e6" | "e7"
export type AttachmentSnapshot = { artifact_id: string; document_id: string; content_sha256: string; file_name: string; mime_type: string; size_bytes: number }
export interface PreparedPursuitHandoff {
  matchId: string
  opportunityId: string
  upstreamId: string
  type: HandoffType
  snapshot: AttachmentSnapshot[]
  attachments?: ResendDeliveryRequest["attachments"]
}
export interface HandoffAttempt {
  delivery_id: string
  operation_key: string
  delivery_status: "sending" | "sent" | "in_flight"
  evidence_id: string | null
}
const rpcFor = { e4: "journey_current_cycle_event", e6: "journey_current_gate_1_event", e7: "journey_current_gate_2_event" } as const

export async function loadPursuitHandoffContext(db: Admin, matchId: string, type: HandoffType) {
  const [{ data: upstreamId, error: upstreamError }, { data: match, error: matchError }] = await Promise.all([
    db.rpc(rpcFor[type], { p_match_id: matchId }),
    db.from("opportunity_matches").select("id,opportunity_id,repreneur_id,status").eq("id", matchId).maybeSingle(),
  ])
  if (upstreamError || typeof upstreamId !== "string" || matchError || match?.status !== "active_pursuit") throw new Error("This handoff requires the current active pursuit and its staff validation.")
  const [{ data: opportunity, error: opportunityError }, { data: repreneur, error: repreneurError }, { data: upstream, error: evidenceError }] = await Promise.all([
    db.from("opportunities").select("id,status,is_demo,public_title").eq("id", match.opportunity_id).maybeSingle(),
    db.from("repreneurs").select("id,email,first_name,is_demo").eq("id", match.repreneur_id).maybeSingle(),
    db.from("opportunity_pursuit_evidence").select("id,match_id,metadata").eq("id", upstreamId).eq("match_id", matchId).maybeSingle(),
  ])
  if (opportunityError || repreneurError || evidenceError || !opportunity || !repreneur || !upstream || opportunity.status !== "active" || typeof opportunity.is_demo !== "boolean" || opportunity.is_demo !== repreneur.is_demo) throw new Error("The handoff audience and current opportunity could not be verified.")
  return { match, opportunity, repreneur, upstream }
}

async function gate2Documents(db: Admin, handoff: PreparedPursuitHandoff) {
  const { data: gate, error } = await db.from("opportunity_pursuit_evidence").select("metadata").eq("id", handoff.upstreamId).eq("match_id", handoff.matchId).maybeSingle()
  const ids = [gate?.metadata?.renew_artifact_id, gate?.metadata?.repreneur_artifact_id]
  if (error || ids.some((id) => typeof id !== "string") || ids[0] === ids[1]) throw new Error("The current Gate 2 signed-copy evidence is unavailable.")
  const { data: artifacts, error: artifactError } = await db.from("opportunity_nda_artifacts")
    .select("id,document_id,opportunity_id,artifact_role,content_sha256,document:opportunity_documents!opportunity_nda_artifacts_document_id_fkey(id,opportunity_id,document_type,visibility,external_url,storage_bucket,storage_path,file_name,mime_type,size_bytes)")
    .in("id", ids).eq("match_id", handoff.matchId)
  if (artifactError || artifacts?.length !== 2) throw new Error("Both retained Gate 2 copies are required.")
  return ids.map((id, index) => {
    const a = artifacts.find((row) => row.id === id)
    const d = Array.isArray(a?.document) ? a.document[0] : a?.document
    const role = index === 0 ? "renew_signed_copy" : "repreneur_signed_copy"
    if (!a || !d || a.opportunity_id !== handoff.opportunityId || d.opportunity_id !== handoff.opportunityId || a.artifact_role !== role || d.document_type !== "nda" || d.visibility !== "staff_only" || d.external_url !== null || d.storage_bucket !== "opportunity-documents" || !d.storage_path?.startsWith(`${handoff.opportunityId}/nda-artifacts/${role}/`) || d.mime_type !== "application/pdf" || !d.file_name?.toLowerCase().endsWith(".pdf") || !(d.size_bytes > 0 && d.size_bytes <= 20 * 1024 * 1024) || !/^[0-9a-f]{64}$/i.test(a.content_sha256 ?? "")) throw new Error("A Gate 2 copy is not the exact retained private PDF for this pursuit.")
    return { artifact: a, document: d, snapshot: { artifact_id: a.id, document_id: d.id, content_sha256: a.content_sha256, file_name: d.file_name, mime_type: d.mime_type, size_bytes: d.size_bytes } as AttachmentSnapshot }
  })
}

export async function preparePursuitHandoff(db: Admin, matchId: string, type: HandoffType) {
  const context = await loadPursuitHandoffContext(db, matchId, type)
  const handoff: PreparedPursuitHandoff = { matchId, opportunityId: context.opportunity.id, upstreamId: context.upstream.id, type, snapshot: [] }
  if (type === "e7") {
    const rows = await gate2Documents(db, handoff)
    const copies: PursuitSignedCopy[] = []
    for (const row of rows) {
      const { data, error } = await db.storage.from("opportunity-documents").download(row.document.storage_path)
      if (error || !data) throw new Error("A signed NDA copy could not be retrieved. No email was sent.")
      const bytes = new Uint8Array(await data.arrayBuffer())
      if (bytes.length !== row.document.size_bytes) throw new Error("A signed NDA copy no longer matches its retained size. No email was sent.")
      copies.push({ artifactId: row.artifact.id, contentSha256: row.artifact.content_sha256, fileName: row.document.file_name, mimeType: row.document.mime_type, bytes })
    }
    assertExactPursuitAttachments(copies)
    handoff.snapshot = rows.map((row) => row.snapshot)
    handoff.attachments = copies.map((copy) => ({ filename: copy.fileName, content: Buffer.from(copy.bytes), contentType: copy.mimeType }))
  }
  return { handoff, context }
}

export async function assertPursuitHandoffCurrent(db: Admin, handoff: PreparedPursuitHandoff) {
  const current = await loadPursuitHandoffContext(db, handoff.matchId, handoff.type)
  if (current.upstream.id !== handoff.upstreamId || current.opportunity.id !== handoff.opportunityId) throw new Error("The staff validation changed. Review the current pursuit before sending.")
  if (handoff.type === "e7") {
    const snapshot = (await gate2Documents(db, handoff)).map((row) => row.snapshot)
    if (JSON.stringify(snapshot) !== JSON.stringify(handoff.snapshot)) throw new Error("The Gate 2 signed copies changed. No email was sent.")
  }
}

export async function beginPursuitHandoff(db: Admin, handoff: PreparedPursuitHandoff, fingerprint: string, actor: string): Promise<HandoffAttempt> {
  await assertPursuitHandoffCurrent(db, handoff)
  const { data, error } = await db.rpc("journey_begin_handoff_delivery", { p_match_id: handoff.matchId, p_upstream_evidence_id: handoff.upstreamId, p_handoff_type: handoff.type, p_request_fingerprint: fingerprint, p_actor: actor, p_attachment_snapshot: handoff.snapshot })
  if (error) {
    const message = error.message ?? ""
    if (message.includes("replay window expired")) throw new Error("The earlier delivery is uncertain and its safe replay window has expired. Staff must reconcile it before another send.")
    if (message.includes("exact original request")) throw new Error("The earlier delivery is uncertain. Restore its original recipient and message before retrying.")
    throw new Error("The current handoff could not be reserved safely. No new email was sent.")
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.delivery_id || !row.operation_key) throw new Error("The handoff reservation was not recorded.")
  return row as HandoffAttempt
}

export async function finalizePursuitHandoff(db: Admin, attempt: HandoffAttempt, actor: string, status: "sent" | "failed", providerMessageId: string | null, error: string | null, interactionId: string | null = null) {
  const { data, error: persistenceError } = await db.rpc("journey_finalize_handoff_delivery", { p_delivery_id: attempt.delivery_id, p_operation_key: attempt.operation_key, p_actor: actor, p_delivery_status: status, p_provider_message_id: providerMessageId, p_delivery_error: error?.slice(0, 240) ?? null, p_ma_interaction_id: interactionId })
  if (persistenceError || (status === "sent" && typeof data !== "string")) throw new Error("The delivery receipt could not be finalized.")
  return typeof data === "string" ? data : undefined
}
