"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"
import { deleteExternalPursuitAttachment } from "@/lib/actions/external-pursuit-attachments"
import { validateExternalPursuitFields } from "@/lib/external-pursuit-validation"
import type {
  ExternalPursuitActionResult, ExternalPursuitContactInput, ExternalPursuitFollowUpInput,
  ExternalPursuitInput, ExternalPursuitStage, ExternalPursuitUpdateInput,
} from "@/lib/types/external-pursuit"

async function selectedOperation(
  ownerId: string, token: string, action: string, pursuitId: string | null,
  args: object, key: string,
): Promise<ExternalPursuitActionResult> {
  const access = await requireStaffAccess()
  if (!isUuid(ownerId) || (pursuitId !== null && !isUuid(pursuitId)) || !key.trim()) {
    throw new Error("Invalid selected External Pursuit.")
  }
  const selected = await verifyStaffPortalSelection(token, ownerId, access.user.id)
  if (!selected) throw new Error("The selected staff workspace changed. Refresh before acting.")
  if ("staffInternalNotes" in args) throw new Error("Staff-only notes are outside this portal view.")
  if (action === "create" || action === "update") {
    const validationError = validateExternalPursuitFields(args as ExternalPursuitInput)
    if (validationError) return { success: false, message: validationError }
  }
  const { data, error, status } = await createAdminClient().rpc("w196_selected_external_operation", {
    p_workspace_id: selected.workspaceId,
    p_generation: selected.generation,
    p_owner_id: ownerId,
    p_staff_user_id: access.user.id,
    p_staff_email: access.user.email,
    p_action: action,
    p_dossier_id: pursuitId,
    p_args: args,
    p_idempotency_key: key,
  })
  if (error || !data) return {
    success: false,
    message: "The selected owner or dossier changed. Refresh this portal view and try again.",
    retryExact: status === 0,
  }
  return { success: true, pursuitId: data.pursuitId ?? pursuitId ?? undefined,
    message: action === "create" ? "External Pursuit created." : "External Pursuit updated." }
}

export async function createSelectedExternalPursuit(ownerId: string, token: string, input: ExternalPursuitInput, key: string) {
  if (input.ownerRepreneurId !== ownerId) throw new Error("This dossier must belong to the selected repreneur.")
  return selectedOperation(ownerId, token, "create", null, input, key)
}

export async function updateSelectedExternalPursuit(ownerId: string, token: string, pursuitId: string, input: ExternalPursuitUpdateInput, key: string) {
  return selectedOperation(ownerId, token, "update", pursuitId, input, key)
}

export async function moveSelectedExternalPursuitStage(ownerId: string, token: string, pursuitId: string, stage: ExternalPursuitStage, key: string) {
  return selectedOperation(ownerId, token, "stage", pursuitId, { stage }, key)
}

export async function saveSelectedExternalPursuitContact(ownerId: string, token: string, pursuitId: string, input: ExternalPursuitContactInput, key: string) {
  return selectedOperation(ownerId, token, "contact", pursuitId, input, key)
}

export async function updateSelectedExternalPursuitFollowUp(ownerId: string, token: string, pursuitId: string, input: ExternalPursuitFollowUpInput, key: string) {
  return selectedOperation(ownerId, token, "followup", pursuitId, input, key)
}

export async function confirmSelectedExternalPursuitCurrent(ownerId: string, token: string, pursuitId: string, key: string) {
  try {
    const result = await selectedOperation(ownerId, token, "confirm", pursuitId, {}, key)
    return result.success
      ? { success: true, outcome: "confirmed" as const, message: "Current status confirmed." }
      : { success: false, outcome: result.retryExact ? "ambiguous" as const : "rejected" as const, message: result.message }
  } catch {
    return { success: false, outcome: "rejected" as const, message: "The selected staff workspace changed. Refresh before confirming." }
  }
}

export async function deleteSelectedExternalPursuitAttachment(ownerId: string, token: string, pursuitId: string, attachmentId: string, key: string) {
  const access = await requireStaffAccess()
  const selected = await verifyStaffPortalSelection(token, ownerId, access.user.id)
  if (!selected || !isUuid(pursuitId) || !isUuid(attachmentId)) {
    throw new Error("The selected staff workspace changed. Refresh before removing a file.")
  }
  return deleteExternalPursuitAttachment(pursuitId, attachmentId, key, {
    ownerId, workspaceId: selected.workspaceId, generation: selected.generation,
  })
}
