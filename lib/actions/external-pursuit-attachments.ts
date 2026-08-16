"use server"

import { randomUUID } from "crypto"
import { getCurrentUserAccess, requireStaffAccess } from "@/lib/access-control"
import {
  EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET,
  safeAttachmentFilename,
  validateExternalPursuitAttachment,
} from "@/lib/external-pursuit-attachments"
import { matchesExpectedFileStructure } from "@/lib/security/external-pursuit-attachment-content"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ExternalPursuitAttachment } from "@/lib/external-pursuit-attachments"

type Result = { success: boolean; message: string; attachmentId?: string; retryExact?: boolean }
type Registration = { attachmentId: string; storagePath: string }

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

function parseRegistration(value: unknown): Registration | null {
  if (!value || typeof value !== "object") return null
  const attachmentId = "attachment_id" in value && typeof value.attachment_id === "string" ? value.attachment_id : null
  const storagePath = "storage_path" in value && typeof value.storage_path === "string" ? value.storage_path : null
  return attachmentId && storagePath ? { attachmentId, storagePath } : null
}

function numericStatus(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && /^\d{1,3}$/.test(value)) return Number(value)
  return null
}

/** Structured Storage API errors prove a response; unknown/status-0 transport failures do not. */
function storageFailureIsAmbiguous(error: unknown) {
  if (!error || typeof error !== "object") return true
  const direct = numericStatus("status" in error ? error.status : null)
    ?? numericStatus("statusCode" in error ? error.statusCode : null)
  if (direct !== null) return direct === 0
  if ("originalError" in error && error.originalError && typeof error.originalError === "object") {
    const original = numericStatus("status" in error.originalError ? error.originalError.status : null)
    if (original !== null) return original === 0
  }
  return true
}

async function replayUploadRegistration(
  supabase: ReturnType<typeof createAdminClient>,
  pursuitId: string,
  actorUserId: string,
  idempotencyKey: string,
) {
  try {
    const { data, error, status } = await supabase.rpc("external_pursuit_attachment_upload_replay", {
      p_dossier_id: pursuitId, p_actor_user_id: actorUserId, p_idempotency_key: idempotencyKey,
    })
    return { registration: parseRegistration(data), error, ambiguous: status === 0 }
  } catch (error) {
    return { registration: null, error, ambiguous: true }
  }
}

async function replayDeletionFulfillment(
  supabase: ReturnType<typeof createAdminClient>,
  pursuitId: string,
  actorUserId: string,
  idempotencyKey: string,
) {
  try {
    const { data, error, status } = await supabase.rpc("external_pursuit_deletion_fulfillment_replay", {
      p_dossier_id: pursuitId,
      p_actor_user_id: actorUserId,
      p_idempotency_key: idempotencyKey,
    })
    return { fulfilled: data === true, error, ambiguous: status === 0 }
  } catch (error) {
    return { fulfilled: false, error, ambiguous: true }
  }
}

async function removeUncommittedObject(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string,
) {
  return removeStorageObjects(supabase, [storagePath])
}

async function removeStorageObjects(
  supabase: ReturnType<typeof createAdminClient>,
  storagePaths: string[],
) {
  try {
    const { error } = await supabase.storage.from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET).remove(storagePaths)
    return error
  } catch (error) {
    return error
  }
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
  idempotencyKey: string = randomUUID(),
): Promise<Result> {
  let storagePath: string | null = null
  let supabase: ReturnType<typeof createAdminClient> | null = null
  let actorUserId: string | null = null
  try {
    const access = await actor()
    actorUserId = access.user.id
    supabase = createAdminClient()
    const existing = await replayUploadRegistration(supabase, pursuitId, actorUserId, idempotencyKey)
    if (existing.error) return { success: false, message: safeMessage(existing.error, "Could not add attachment."), retryExact: existing.ambiguous }
    if (existing.registration) return { success: true, message: "Attachment added.", attachmentId: existing.registration.attachmentId }
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
    let uploadError: unknown = null
    try {
      const result = await supabase.storage
        .from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET)
        .upload(storagePath, bytes, { contentType: file.type, upsert: false })
      uploadError = result.error
    } catch (error) {
      uploadError = error
    }
    if (uploadError) {
      const ambiguous = storageFailureIsAmbiguous(uploadError)
      return {
        success: false,
        message: ambiguous ? "The upload result is unclear. Retry the exact same file." : "Could not store attachment.",
        retryExact: ambiguous,
      }
    }
    let registration: Registration | null = null
    let registrationError: unknown = null
    let registrationAmbiguous = false
    try {
      const result = await supabase.rpc("register_external_pursuit_attachment", {
        p_dossier_id: pursuitId,
        p_storage_path: storagePath,
        p_original_filename: safeAttachmentFilename(file.name),
        p_content_type: file.type,
        p_byte_size: file.size,
        p_actor_user_id: actorUserId,
        p_idempotency_key: idempotencyKey,
      })
      registration = parseRegistration(result.data)
      registrationError = result.error
      registrationAmbiguous = result.status === 0
    } catch (error) {
      registrationError = error
      registrationAmbiguous = true
    }

    if (registrationError || !registration) {
      // A network/response failure can occur after the database commit. Resolve
      // the exact actor+dossier+idempotency replay before touching storage.
      const replay = await replayUploadRegistration(supabase, pursuitId, actorUserId, idempotencyKey)
      if (replay.error) return {
        success: false,
        message: "Attachment registration is uncertain; retry the exact same file.",
        retryExact: registrationAmbiguous || replay.ambiguous,
      }
      registration = replay.registration
      if (!registration) {
        const cleanupError = await removeUncommittedObject(supabase, storagePath)
        return cleanupError
          ? { success: false, message: "Attachment registration failed; storage cleanup needs staff attention." }
          : { success: false, message: safeMessage(registrationError, "Could not register attachment.") }
      }
    }

    if (registration.storagePath !== storagePath) {
      // A concurrent request with the same idempotency key won. Remove only the
      // losing request's newly uploaded random object, never the committed path.
      const losingObjectCleanupError = await removeUncommittedObject(supabase, storagePath)
      if (losingObjectCleanupError) return {
        success: false,
        message: "Attachment retry was accepted, but duplicate storage cleanup needs staff attention.",
        // The canonical database row is already known. Replaying the business
        // action cannot resolve cleanup of this non-authoritative random path,
        // so release the UI lock and surface the operational exception.
        retryExact: false,
      }
    }
    return { success: true, message: "Attachment added.", attachmentId: registration.attachmentId }
  } catch (error) {
    if (storagePath && supabase && actorUserId) {
      const replay = await replayUploadRegistration(supabase, pursuitId, actorUserId, idempotencyKey)
      if (replay.error) return { success: false, message: "Attachment registration is uncertain; retry the exact same file.", retryExact: replay.ambiguous }
      if (replay.registration) {
        if (replay.registration.storagePath !== storagePath) {
          const cleanupError = await removeUncommittedObject(supabase, storagePath)
          if (cleanupError) return {
            success: false,
            message: "Attachment retry was accepted, but duplicate storage cleanup needs staff attention.",
            retryExact: false,
          }
        }
        return { success: true, message: "Attachment added.", attachmentId: replay.registration.attachmentId }
      }
      const cleanupError = await removeUncommittedObject(supabase, storagePath)
      if (cleanupError) return { success: false, message: "Attachment registration failed; storage cleanup needs staff attention." }
    }
    return { success: false, message: safeMessage(error, "Could not add attachment.") }
  }
}

export async function deleteExternalPursuitAttachment(
  pursuitId: string,
  attachmentId: string,
  idempotencyKey: string = randomUUID(),
): Promise<Result> {
  let storageMutationStarted = false
  try {
    const access = await actor()
    const supabase = createAdminClient()
    const { data: storagePath, error: lookupError, status: lookupStatus } = await supabase.rpc("delete_external_pursuit_attachment_record", {
      p_dossier_id: pursuitId, p_attachment_id: attachmentId, p_actor_user_id: access.user.id, p_idempotency_key: idempotencyKey,
    })
    if (lookupError) return { success: false, message: safeMessage(lookupError, "Could not remove attachment."), retryExact: lookupStatus === 0 }
    if (!storagePath) return { success: true, message: "Attachment removed." }
    storageMutationStarted = true
    const storageError = await removeStorageObjects(supabase, [storagePath])
    if (storageError) {
      const ambiguous = storageFailureIsAmbiguous(storageError)
      return {
        success: false,
        message: ambiguous ? "Attachment removal was not confirmed. Retry the exact removal." : "Attachment removal failed; the dossier was left unchanged.",
        retryExact: ambiguous,
      }
    }
    const { error: finalizeError, status: finalizeStatus } = await supabase.rpc("finalize_external_pursuit_attachment_deletion", {
      p_dossier_id: pursuitId, p_attachment_id: attachmentId, p_actor_user_id: access.user.id, p_idempotency_key: idempotencyKey,
    })
    return finalizeError
      ? {
          success: false,
          message: "The file was removed but its record was not confirmed.",
          retryExact: finalizeStatus === 0,
        }
      : { success: true, message: "Attachment removed." }
  } catch (error) {
    return {
      success: false,
      message: storageMutationStarted ? "Attachment removal was not confirmed. Retry the exact removal." : safeMessage(error, "Could not remove attachment."),
      retryExact: storageMutationStarted,
    }
  }
}

/** W-108 wrapper: all private objects must be removed before W-105 may tombstone. */
export async function fulfillExternalPursuitDeletionWithAttachments(
  pursuitId: string,
  idempotencyKey: string = randomUUID(),
): Promise<Result> {
  let supabase: ReturnType<typeof createAdminClient> | null = null
  let staffUserId: string | null = null
  let destructiveStepStarted = false
  let finalFulfillmentStarted = false
  try {
    const staff = await requireStaffAccess()
    staffUserId = staff.user.id
    supabase = createAdminClient()

    // A prior final RPC may have committed and lost its response. Check the
    // staff-authorized exact tombstone replay before querying the now-removed
    // live dossier or attachment rows.
    const existing = await replayDeletionFulfillment(supabase, pursuitId, staffUserId, idempotencyKey)
    if (existing.error) return {
      success: false,
      message: safeMessage(existing.error, "Could not verify deletion."),
      retryExact: existing.ambiguous,
    }
    if (existing.fulfilled) return { success: true, message: "External Pursuit deleted." }

    const { data: attachments, error: listError, status: listStatus } = await supabase.rpc("external_pursuit_attachment_cleanup_for_fulfillment", {
      p_dossier_id: pursuitId, p_actor_user_id: staffUserId,
    })
    if (listError) return { success: false, message: safeMessage(listError, "Could not prepare deletion."), retryExact: listStatus === 0 }
    const paths = (attachments ?? []).map((attachment: { storage_path: string }) => attachment.storage_path)
    if (paths.length) {
      destructiveStepStarted = true
      const storageError = await removeStorageObjects(supabase, paths)
      if (storageError) {
        const ambiguous = storageFailureIsAmbiguous(storageError)
        return {
          success: false,
          message: ambiguous ? "Attachment cleanup was not confirmed. Retry the exact deletion." : "Attachment cleanup failed; the dossier was left unchanged.",
          retryExact: ambiguous,
        }
      }
    }
    destructiveStepStarted = true
    const { error: clearError, status: clearStatus } = await supabase.rpc("clear_external_pursuit_attachment_records_for_fulfillment", {
      p_dossier_id: pursuitId, p_actor_user_id: staffUserId,
    })
    if (clearError) return {
      success: false,
      message: "Attachment cleanup could not be recorded; the dossier was not deleted.",
      retryExact: clearStatus === 0,
    }
    finalFulfillmentStarted = true
    const { error: fulfillError, status: fulfillStatus } = await supabase.rpc("fulfill_external_pursuit_deletion", {
      p_dossier_id: pursuitId, p_actor_user_id: staffUserId, p_idempotency_key: idempotencyKey,
    })
    if (!fulfillError) return { success: true, message: "External Pursuit deleted." }

    const replay = await replayDeletionFulfillment(supabase, pursuitId, staffUserId, idempotencyKey)
    if (replay.fulfilled) return { success: true, message: "External Pursuit deleted." }
    return {
      success: false,
      message: safeMessage(fulfillError, "Could not fulfil deletion."),
      retryExact: fulfillStatus === 0 || replay.ambiguous,
    }
  } catch (error) {
    if (finalFulfillmentStarted && supabase && staffUserId) {
      const replay = await replayDeletionFulfillment(supabase, pursuitId, staffUserId, idempotencyKey)
      if (replay.fulfilled) return { success: true, message: "External Pursuit deleted." }
    }
    return {
      success: false,
      message: safeMessage(error, "Could not fulfil deletion."),
      retryExact: destructiveStepStarted,
    }
  }
}
