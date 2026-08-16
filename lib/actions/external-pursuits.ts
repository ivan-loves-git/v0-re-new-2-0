"use server"

import { randomUUID } from "crypto"
import { getCurrentUserAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ExternalPursuitActionResult,
  ExternalPursuitContactInput,
  ExternalPursuitInput,
  ExternalPursuitUpdateInput,
} from "@/lib/types/external-pursuit"

function message(error: unknown, fallback: string) {
  // Database errors are intentionally not logged here: a staff-only note must
  // never reach a server log or repreneur-visible error surface.
  return error instanceof Error && /required|not found|not editable|denied/i.test(error.message)
    ? error.message
    : fallback
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function validOptionalDate(value: string | null | undefined) {
  if (value === undefined || value === null) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

async function currentActor() {
  const access = await getCurrentUserAccess()
  if (!access || access.role === "unassigned") throw new Error("External Pursuit access denied.")
  return access
}

/**
 * Server-only role-safe projection. The owner path has no staff-note field in
 * either its result or error handling; the database applies the same boundary.
 */
export async function getExternalPursuit(pursuitId: string) {
  const access = await currentActor()
  const { data, error } = await createAdminClient().rpc("external_pursuit_for_actor", {
    p_dossier_id: pursuitId,
    p_actor_user_id: access.user.id,
  })
  if (error) throw new Error(message(error, "Could not load External Pursuit."))
  return data
}

export async function createExternalPursuit(
  input: ExternalPursuitInput,
  idempotencyKey = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    if (!validOptionalDate(input.dueAt)) return { success: false, message: "Due date must use a valid YYYY-MM-DD date." }
    const ownerRepreneurId =
      access.role === "staff" ? input.ownerRepreneurId : access.repreneurId
    if (!ownerRepreneurId) return { success: false, message: "Choose the dossier owner." }
    const { data, error } = await createAdminClient().rpc("create_external_pursuit", {
      p_owner_repreneur_id: ownerRepreneurId,
      p_title: input.title,
      p_stage: input.stage ?? "identified",
      p_availability: input.availability ?? "unknown",
      p_due_at: dateOrNull(input.dueAt),
      p_shared_notes: input.sharedNotes ?? null,
      p_staff_internal_notes: access.role === "staff" ? input.staffInternalNotes ?? null : null,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    if (error || !data) return { success: false, message: message(error, "Could not create External Pursuit.") }
    return { success: true, message: "External Pursuit created.", pursuitId: data }
  } catch (error) {
    return { success: false, message: message(error, "Could not create External Pursuit.") }
  }
}

export async function updateExternalPursuit(
  pursuitId: string,
  input: ExternalPursuitUpdateInput,
  idempotencyKey = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    if (!validOptionalDate(input.dueAt)) return { success: false, message: "Due date must use a valid YYYY-MM-DD date." }
    const { error } = await createAdminClient().rpc("update_external_pursuit", {
      p_dossier_id: pursuitId,
      p_title: input.title,
      p_stage: input.stage ?? null,
      p_stage_provided: input.stage !== undefined,
      p_availability: input.availability ?? null,
      p_availability_provided: input.availability !== undefined,
      p_due_at: dateOrNull(input.dueAt),
      p_due_at_provided: input.dueAt !== undefined,
      p_shared_notes: input.sharedNotes ?? null,
      p_shared_notes_provided: input.sharedNotes !== undefined,
      p_staff_internal_notes: access.role === "staff" ? input.staffInternalNotes ?? null : null,
      p_staff_notes_provided: access.role === "staff" && input.staffInternalNotes !== undefined,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    return error ? { success: false, message: message(error, "Could not update External Pursuit.") } : { success: true, message: "External Pursuit updated.", pursuitId }
  } catch (error) {
    return { success: false, message: message(error, "Could not update External Pursuit.") }
  }
}

export async function saveExternalPursuitContact(
  pursuitId: string,
  input: ExternalPursuitContactInput,
  idempotencyKey = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    const { data, error } = await createAdminClient().rpc("save_external_pursuit_contact", {
      p_dossier_id: pursuitId,
      p_contact_id: input.id ?? null,
      p_name: input.name ?? null,
      p_organisation: input.organisation ?? null,
      p_role_title: input.roleTitle ?? null,
      p_email: input.email ?? null,
      p_phone: input.phone ?? null,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    return error ? { success: false, message: message(error, "Could not save contact.") } : { success: true, message: "Contact saved.", pursuitId: data }
  } catch (error) {
    return { success: false, message: message(error, "Could not save contact.") }
  }
}

export async function requestExternalPursuitDeletion(
  pursuitId: string,
  idempotencyKey = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    const { error } = await createAdminClient().rpc("request_external_pursuit_deletion", {
      p_dossier_id: pursuitId,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    return error ? { success: false, message: message(error, "Could not request deletion.") } : { success: true, message: "Deletion requested.", pursuitId }
  } catch (error) {
    return { success: false, message: message(error, "Could not request deletion.") }
  }
}

/** W-108 must remove its private file objects before this staff-only primitive. */
export async function fulfillExternalPursuitDeletion(
  pursuitId: string,
  idempotencyKey = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const staff = await requireStaffAccess()
    const { error } = await createAdminClient().rpc("fulfill_external_pursuit_deletion", {
      p_dossier_id: pursuitId,
      p_actor_user_id: staff.user.id,
      p_idempotency_key: idempotencyKey,
    })
    return error ? { success: false, message: message(error, "Could not fulfil deletion.") } : { success: true, message: "External Pursuit deleted.", pursuitId }
  } catch (error) {
    return { success: false, message: message(error, "Could not fulfil deletion.") }
  }
}
