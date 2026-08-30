"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireStaffAccess } from "@/lib/access-control"
import { assertPdrAttachment, canDispositionPdr, pdrAttachmentPath, PDR_ATTACHMENT_BUCKET } from "@/lib/pdr/intake-server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"

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
    problem_statement: title, status: "draft",
  }).select("id").single()
  if (error || !proposal) throw new Error("The request could not be saved.")

  const files = formData.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0)
  try {
    for (const file of files) {
      assertPdrAttachment(file)
      const path = pdrAttachmentPath(proposal.id, file.name)
      const { error: uploadError } = await supabase.storage.from(PDR_ATTACHMENT_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
      if (uploadError) throw new Error("Attachment upload failed.")
      const { error: recordError } = await supabase.from("wave_pdr_request_attachments").insert({
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
  const { error } = await createAdminClient().from("pdr_proposals").update({
    disposition_kind: disposition, disposition_by_user_id: access.user.id, disposition_at: new Date().toISOString(), reviewer_note: note,
  }).eq("id", requestId).is("disposition_kind", null)
  if (error) throw new Error("The disposition could not be recorded.")
  revalidatePath("/strategic-pdr/requests")
  revalidatePath(`/strategic-pdr/requests/${requestId}`)
}
