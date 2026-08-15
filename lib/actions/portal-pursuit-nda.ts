"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { queueM2RepreneurEvent } from "@/lib/telemetry/m2-repreneur"

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
export type PortalPursuitNdaUploadResult = { success: true; message: string; artifactId: string; versionNumber: number } | { success: false; message: string }

export async function submitPortalPursuitSignedNda(formData: FormData): Promise<PortalPursuitNdaUploadResult> {
  const access = await requirePortalAccess()
  const capture = (outcome: "success" | "failure" | "validation_error", errorCode?: "validation_failed" | "unavailable" | "upload_failed" | "persistence_failed") => {
    queueM2RepreneurEvent({
      userId: access.user.id,
      routeTemplate: "/portal/deals/:matchId",
      workflow: "portal_pursuit",
      action: "upload",
      outcome,
      ...(errorCode ? { errorCode } : {}),
    })
  }
  const matchId = String(formData.get("match_id") ?? "").trim()
  const title = String(formData.get("title") ?? "Signed NDA").trim() || "Signed NDA"
  const file = formData.get("file")
  if (!matchId || !(file instanceof File) || file.size <= 0) {
    capture("validation_error", "validation_failed")
    return { success: false, message: "Choose your signed NDA PDF." }
  }
  if (file.size > MAX_DOCUMENT_BYTES || !file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    capture("validation_error", "validation_failed")
    return { success: false, message: "The signed NDA must be a PDF smaller than 4 MB." }
  }
  const supabase = createAdminClient()
  const { data: match, error: matchError } = await supabase.from("opportunity_matches").select("id, opportunity_id, repreneur_id, status").eq("id", matchId).maybeSingle()
  if (matchError || !match || match.repreneur_id !== access.repreneurId || match.status !== "active_pursuit") {
    capture("failure", "unavailable")
    return { success: false, message: "This NDA is not available for upload." }
  }
  // PostgreSQL repeats this check while holding the match lock. This early
  // check is only a truthful UX shortcut, never the authority boundary.
  const { data: gate, error: gateError } = await supabase.rpc("journey_current_gate_1_event", { p_match_id: matchId })
  if (gateError || !gate) {
    capture("failure", "unavailable")
    return { success: false, message: "The NDA is not ready for your signature yet." }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const contentSha256 = createHash("sha256").update(buffer).digest("hex")
  const { data: existing } = await supabase.from("opportunity_nda_artifacts").select("id, version_number").eq("match_id", matchId).eq("artifact_role", "repreneur_signed_copy").eq("content_sha256", contentSha256).maybeSingle()
  if (existing) {
    capture("success")
    return { success: true, message: "Your signed NDA has already been received for staff validation.", artifactId: existing.id, versionNumber: existing.version_number }
  }
  const path = `${match.opportunity_id}/nda-artifacts/repreneur_signed_copy/${randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`
  const { error: uploadError } = await supabase.storage.from("opportunity-documents").upload(path, buffer, { contentType: "application/pdf", upsert: false })
  if (uploadError) {
    capture("failure", "upload_failed")
    return { success: false, message: "Your signed NDA could not be uploaded. Please try again." }
  }
  const { data, error } = await supabase.rpc("journey_submit_repreneur_signed_copy_v2", { p_match_id: matchId, p_repreneur_id: access.repreneurId, p_actor_email: access.user.email, p_title: title, p_storage_path: path, p_file_name: file.name, p_file_size: file.size, p_content_sha256: contentSha256 })
  if (error) {
    // The RPC has a content-hash uniqueness constraint. A conclusive reject
    // cannot have retained this random object path; ambiguous transport
    // failures deliberately leave it for reconciliation instead of risking
    // deletion after a committed write.
    await supabase.storage.from("opportunity-documents").remove([path])
    capture("failure", "persistence_failed")
    return { success: false, message: "Your signed NDA is no longer ready for upload. Refresh and try again." }
  }
  const result = Array.isArray(data) ? data[0] : data
  if (result?.reused_existing) await supabase.storage.from("opportunity-documents").remove([path])
  revalidatePath("/portal/deals")
  capture("success")
  return { success: true, message: "Your signed NDA has been received for staff validation.", artifactId: result?.artifact_id, versionNumber: result?.version_number }
}
