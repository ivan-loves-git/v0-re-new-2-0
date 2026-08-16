"use server"

import { randomUUID } from "crypto"
import { getCurrentUserAccess, requireStaffAccess } from "@/lib/access-control"
import {
  EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET,
  matchesExpectedFileStructure,
  safeAttachmentFilename,
  validateExternalPursuitAttachment,
} from "@/lib/external-pursuit-attachments"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ExternalPursuitAttachment } from "@/lib/external-pursuit-attachments"

type Result = { success: boolean; message: string; attachmentId?: string }

function safeMessage(error: unknown, fallback: string) {
  return error instanceof Error && /denied|not found|not editable|required|invalid/i.test(error.message)
    ? error.message
    : fallback
}

async function actor() {
  const access = await getCurrentUserAccess()
  if (!access || access.role === "unassigned") throw new Error("External Pursuit access denied.")
  return access
}

export async function getExternalPursuitAttachments(pursuitId: string): Promise<ExternalPursuitAttachment[]> {
  const access = await actor()
  const { data, error } = await createAdminClient().rpc("external_pursuit_attachments_for_actor", {
    p_dossier_id: pursuitId,
    p_actor_user_id: access.user.id,
  })
  if (error) throw new Error(safeMessage(error, "Could not load attachments."))
  return (data ?? []) as ExternalPursuitAttachment[]
}

/** Batch the board's already-authorized dossier ids without exposing storage. */
export async function getExternalPursuitAttachmentMap(
  pursuitIds: string[],
): Promise<Record<string, ExternalPursuitAttachment[]>> {
  if (pursuitIds.length > 200) throw new Error("Too many External Pursuits requested.")
  const access = await actor()
  const supabase = createAdminClient()
  const entries = await Promise.all([...new Set(pursuitIds)].map(async (pursuitId) => {
    const { data, error } = await supabase.rpc("external_pursuit_attachments_for_actor", {
      p_dossier_id: pursuitId,
      p_actor_user_id: access.user.id,
    })
    if (error) throw new Error(safeMessage(error, "Could not load attachments."))
    return [pursuitId, (data ?? []) as ExternalPursuitAttachment[]] as const
  }))
  return Object.fromEntries(entries)
}

export async function uploadExternalPursuitAttachment(
  pursuitId: string,
  formData: FormData,
  idempotencyKey = randomUUID(),
): Promise<Result> {
  let storagePath: string | null = null
  let registeredStoragePath: string | null = null
  try {
    const access = await actor()
    const supabase = createAdminClient()
    const { data: existingAttachmentId, error: replayError } = await supabase.rpc("external_pursuit_attachment_upload_replay", {
      p_dossier_id: pursuitId, p_actor_user_id: access.user.id, p_idempotency_key: idempotencyKey,
    })
    if (replayError) return { success: false, message: safeMessage(replayError, "Could not add attachment.") }
    if (existingAttachmentId) return { success: true, message: "Attachment added.", attachmentId: existingAttachmentId }
    const file = formData.get("file")
    if (!(file instanceof File)) return { success: false, message: "Choose a file to attach." }
    const validation = validateExternalPursuitAttachment(file)
    if (validation) return { success: false, message: validation }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!matchesExpectedFileStructure(file.name, bytes)) return { success: false, message: "The file contents do not match its permitted type." }
    const extension = file.name.trim().split(".").at(-1)?.toLowerCase()
    if (!extension) return { success: false, message: "The file name is invalid." }
    const attachmentObjectId = randomUUID()
    storagePath = `${pursuitId}/${attachmentObjectId}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadError) return { success: false, message: "Could not store attachment." }
    const { data: registration, error: registrationError } = await supabase.rpc("register_external_pursuit_attachment", {
      p_dossier_id: pursuitId,
      p_storage_path: storagePath,
      p_original_filename: safeAttachmentFilename(file.name),
      p_content_type: file.type,
      p_byte_size: file.size,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    if (registrationError || !registration || typeof registration !== "object") {
      const { error: cleanupError } = await supabase.storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove([storagePath])
      if (cleanupError) return { success: false, message: "Attachment registration failed; storage cleanup needs staff attention." }
      return { success: false, message: safeMessage(registrationError, "Could not register attachment.") }
    }
    const attachmentId = "attachment_id" in registration && typeof registration.attachment_id === "string" ? registration.attachment_id : null
    registeredStoragePath = "storage_path" in registration && typeof registration.storage_path === "string" ? registration.storage_path : null
    if (!attachmentId || !registeredStoragePath) {
      const { error: cleanupError } = await supabase.storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove([storagePath])
      return cleanupError
        ? { success: false, message: "Attachment registration was ambiguous; storage cleanup needs staff attention." }
        : { success: false, message: "Could not confirm attachment registration." }
    }
    if (registeredStoragePath !== storagePath) {
      // A concurrent request with the same idempotency key won. Remove only the
      // losing request's newly uploaded random object, never the committed path.
      const { error: losingObjectCleanupError } = await supabase.storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove([storagePath])
      if (losingObjectCleanupError) return { success: false, message: "Attachment retry was accepted, but duplicate storage cleanup needs staff attention." }
    }
    return { success: true, message: "Attachment added.", attachmentId }
  } catch (error) {
    if (storagePath && registeredStoragePath !== storagePath) {
      await createAdminClient().storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove([storagePath])
    }
    return { success: false, message: safeMessage(error, "Could not add attachment.") }
  }
}

export async function deleteExternalPursuitAttachment(
  pursuitId: string,
  attachmentId: string,
  idempotencyKey = randomUUID(),
): Promise<Result> {
  try {
    const access = await actor()
    const supabase = createAdminClient()
    const { data: storagePath, error: lookupError } = await supabase.rpc("delete_external_pursuit_attachment_record", {
      p_dossier_id: pursuitId, p_attachment_id: attachmentId, p_actor_user_id: access.user.id, p_idempotency_key: idempotencyKey,
    })
    if (lookupError) return { success: false, message: safeMessage(lookupError, "Could not remove attachment.") }
    if (!storagePath) return { success: true, message: "Attachment removed." }
    const { error: storageError } = await supabase.storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove([storagePath])
    if (storageError) return { success: false, message: "Attachment removal failed; the dossier was left unchanged." }
    const { error: finalizeError } = await supabase.rpc("finalize_external_pursuit_attachment_deletion", {
      p_dossier_id: pursuitId, p_attachment_id: attachmentId, p_actor_user_id: access.user.id, p_idempotency_key: idempotencyKey,
    })
    return finalizeError
      ? { success: false, message: "The file was removed but its record needs staff attention." }
      : { success: true, message: "Attachment removed." }
  } catch (error) {
    return { success: false, message: safeMessage(error, "Could not remove attachment.") }
  }
}

/** W-108 wrapper: all private objects must be removed before W-105 may tombstone. */
export async function fulfillExternalPursuitDeletionWithAttachments(
  pursuitId: string,
  idempotencyKey: string = randomUUID(),
): Promise<Result> {
  try {
    const staff = await requireStaffAccess()
    const supabase = createAdminClient()
    const { data: attachments, error: listError } = await supabase.rpc("external_pursuit_attachment_cleanup_for_fulfillment", {
      p_dossier_id: pursuitId, p_actor_user_id: staff.user.id,
    })
    if (listError) return { success: false, message: safeMessage(listError, "Could not prepare deletion.") }
    const paths = (attachments ?? []).map((attachment: { storage_path: string }) => attachment.storage_path)
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove(paths)
      if (storageError) return { success: false, message: "Attachment cleanup failed; the dossier was left unchanged." }
    }
    const { error: clearError } = await supabase.rpc("clear_external_pursuit_attachment_records_for_fulfillment", {
      p_dossier_id: pursuitId, p_actor_user_id: staff.user.id,
    })
    if (clearError) return { success: false, message: "Attachment cleanup could not be recorded; the dossier was not deleted." }
    const { error: fulfillError } = await supabase.rpc("fulfill_external_pursuit_deletion", {
      p_dossier_id: pursuitId, p_actor_user_id: staff.user.id, p_idempotency_key: idempotencyKey,
    })
    return fulfillError
      ? { success: false, message: safeMessage(fulfillError, "Could not fulfil deletion.") }
      : { success: true, message: "External Pursuit deleted." }
  } catch (error) {
    return { success: false, message: safeMessage(error, "Could not fulfil deletion.") }
  }
}
