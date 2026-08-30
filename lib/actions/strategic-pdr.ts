"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireStaffAccess } from "@/lib/access-control"
import { assertPdrAttachment, canDispositionPdr, getPdrRequestHistory, pdrAttachmentPath, PDR_ATTACHMENT_BUCKET } from "@/lib/pdr/intake-server"
import { PDR_DISPOSITIONABLE_PROPOSAL_STATUS, PDR_WAVE_STAFF_INTAKE_PROVENANCE } from "@/lib/pdr/disposition-eligibility"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import { readCurrentGovernanceProjection } from "@/lib/governance-projection/server"
import { isGovernanceProjectionStale } from "@/lib/governance-projection/freshness"
import { PDR_SCREENING_OUTPUT_SCHEMA_VERSION, PDR_SCREENING_PROMPT_VERSION, generatePdrScreening, validatePdrScreeningDraft } from "@/lib/ai/pdr-screening"
import { pdrScreeningSaveSchema, type PdrScreeningContext, type PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"
import { completeWaveAiRun, failWaveAiRun, startWaveAiRun } from "@/lib/ai/ledger"
import { classifyWaveAiError } from "@/lib/ai/errors"
import { estimateWaveAiCostUsd, normalizeWaveAiUsage } from "@/lib/ai/usage"
import { createPdrScreeningPreviewToken, validatePdrScreeningPreviewToken } from "@/lib/ai/pdr-screening-preview-token"
import { getOpaqueTelemetryUserId } from "@/lib/telemetry/identity"

const text = (form: FormData, key: string, max: number) => {
  const value = form.get(key)
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export async function submitStrategicPdrRequest(formData: FormData) {
  const access = await requireStaffAccess()
  const title = text(formData, "title", 140)
  const originalText = text(formData, "original_text", 4000)
  if (title.length < 3 || originalText.length < 10) throw new Error("Add a title and at least a short description.")
  const supabase = createAdminClient()
  const { data: proposal, error } = await supabase.from("pdr_proposals").insert({
    original_text: originalText, created_by: "Staff", requester_actor: "Staff",
    requester_user_id: access.user.id, requester_display_name: access.user.name?.trim() || access.user.email?.trim() || "Staff",
    problem_statement: title, status: "draft", intake_provenance: PDR_WAVE_STAFF_INTAKE_PROVENANCE,
  }).select("id").single()
  if (error || !proposal) throw new Error("The request could not be saved.")

  const files = formData.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0)
  try {
    for (const file of files) {
      assertPdrAttachment(file)
      const path = pdrAttachmentPath(proposal.id, file.name)
      const { error: uploadError } = await supabase.storage.from(PDR_ATTACHMENT_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
      if (uploadError) throw new Error("Attachment upload failed.")
      const { error: recordError } = await supabase.from("wave_pdr_history_attachments").insert({
        proposal_id: proposal.id, storage_path: path, original_filename: file.name, content_type: file.type,
        size_bytes: file.size, uploaded_by_user_id: access.user.id,
      })
      if (recordError) { await supabase.storage.from(PDR_ATTACHMENT_BUCKET).remove([path]); throw new Error("Attachment could not be recorded.") }
    }
  } catch (cause) {
    // The request remains as auditable intake evidence; the UI does not claim
    // that an attachment succeeded when its private record could not be made.
    throw new Error(cause instanceof Error ? cause.message : "Attachment upload failed.")
  }
  revalidatePath("/strategic-pdr/requests")
  redirect(`/strategic-pdr/requests/${proposal.id}`)
}

export async function dispositionStrategicPdrRequest(formData: FormData) {
  const access = await requireStaffAccess()
  const requestId = text(formData, "request_id", 80)
  const disposition = text(formData, "disposition", 20)
  const note = text(formData, "reviewer_note", 2000)
  if (!isUuid(requestId) || !["approved", "declined"].includes(disposition)) throw new Error("This request or disposition is invalid.")
  if (!await canDispositionPdr(access.user.id)) throw new Error("Only Ivan can disposition Strategic PDR intake.")
  const { data, error } = await createAdminClient().from("pdr_proposals").update({
    disposition_kind: disposition, disposition_by_user_id: access.user.id, disposition_at: new Date().toISOString(), reviewer_note: note,
  }).eq("id", requestId)
    .eq("status", PDR_DISPOSITIONABLE_PROPOSAL_STATUS)
    .eq("requester_actor", "Staff")
    .not("requester_user_id", "is", null)
    .eq("intake_provenance", PDR_WAVE_STAFF_INTAKE_PROVENANCE)
    .is("disposition_kind", null)
    .select("id")
  if (error || data?.length !== 1) throw new Error("The request was not found or was already disposed.")
  revalidatePath("/strategic-pdr/requests")
  revalidatePath(`/strategic-pdr/requests/${requestId}`)
}

function screeningRequestId(formData: FormData) {
  const requestId = text(formData, "request_id", 80)
  if (!isUuid(requestId)) throw new Error("This request is invalid.")
  return requestId
}

async function loadScreenableRequest(requestId: string) {
  const request = await getPdrRequestHistory(requestId)
  if (!request || request.provenance !== "proposal" || request.intakeProvenance !== PDR_WAVE_STAFF_INTAKE_PROVENANCE || request.requester.actor !== "Staff" || !request.requester.userId || request.screening.status !== "draft" || request.disposition.kind) {
    throw new Error("Only authenticated WAVE staff requests can be screened here.")
  }
  return request
}

/** Preview only. It never writes PDR evidence or delivery records. */
export async function generateStrategicPdrScreening(formData: FormData): Promise<{ draft: PdrScreeningDraft; context: PdrScreeningContext; previewToken: string }> {
  const access = await requireStaffAccess()
  const requestId = screeningRequestId(formData)
  const current = await readCurrentGovernanceProjection()
  if (current.state !== "available") throw new Error("The GitHub governance snapshot is unavailable. No AI request was made.")
  const request = await loadScreenableRequest(requestId)
  const startedAt = Date.now()
  let run: Awaited<ReturnType<typeof startWaveAiRun>> | null = null
  try {
    run = await startWaveAiRun({ actorUserId: access.user.id, feature: "pdr_screening", workflow: "pdr_screening_preview", surface: "/strategic-pdr/requests" , promptVersion: PDR_SCREENING_PROMPT_VERSION, outputSchemaVersion: PDR_SCREENING_OUTPUT_SCHEMA_VERSION })
    const result = await generatePdrScreening({ request: { id: request.id, title: request.title, originalText: request.originalText }, current, safetyIdentifier: getOpaqueTelemetryUserId(access.user.id) })
    const usage = normalizeWaveAiUsage(result.usage)
    await completeWaveAiRun({ generationId: run.generationId, usage, estimatedCostUsd: estimateWaveAiCostUsd(usage), latencyMs: Date.now() - startedAt })
    return { draft: result.draft, context: result.context, previewToken: createPdrScreeningPreviewToken({ generationId: run.generationId, userId: access.user.id, requestId, context: result.context, draft: result.draft }) }
  } catch (cause) {
    if (run) await failWaveAiRun({ generationId: run.generationId, code: classifyWaveAiError(cause), latencyMs: Date.now() - startedAt })
    throw new Error("The screening preview could not be generated. No screening was saved.")
  }
}

/** Explicit human save: revalidates the exact immutable request and snapshot. */
export async function saveStrategicPdrScreening(input: unknown) {
  const access = await requireStaffAccess()
  const parsed = pdrScreeningSaveSchema.safeParse(input)
  if (!parsed.success) throw new Error("The screening preview is invalid.")
  const current = await readCurrentGovernanceProjection()
  if (current.state !== "available") throw new Error("The GitHub governance snapshot is unavailable. Nothing was saved.")
  const freshness = isGovernanceProjectionStale(current.projection.snapshotAt) ? "stale" : "fresh"
  const preview = validatePdrScreeningPreviewToken(parsed.data.previewToken, { userId: access.user.id, requestId: parsed.data.requestId })
  if (!preview) throw new Error("The screening preview expired or is invalid. Generate a new preview.")
  if (current.snapshotId !== preview.context.snapshotId || current.digest !== preview.context.digest || current.projection.registryRevision !== preview.context.registryRevision || current.projection.snapshotAt !== preview.context.snapshotAt || freshness !== preview.context.freshness) {
    throw new Error("The governance context changed. Generate a new preview before saving.")
  }
  const request = await loadScreenableRequest(parsed.data.requestId)
  const draft = validatePdrScreeningDraft(preview.draft, current, freshness)
  const { error } = await createAdminClient().from("wave_pdr_screening_records").insert({
    proposal_id: request.id, created_by_user_id: access.user.id, output: draft,
    governance_snapshot_id: current.snapshotId, governance_snapshot_digest: current.digest,
    registry_revision: current.projection.registryRevision, governance_snapshot_at: current.projection.snapshotAt,
    freshness, prompt_version: PDR_SCREENING_PROMPT_VERSION, output_schema_version: PDR_SCREENING_OUTPUT_SCHEMA_VERSION, generation_id: preview.generationId,
  })
  if (error) throw new Error("The screening could not be saved.")
  revalidatePath(`/strategic-pdr/requests/${request.id}`)
}
