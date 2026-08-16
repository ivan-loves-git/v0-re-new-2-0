"use server"

import { randomUUID } from "crypto"
import { getCurrentUserAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ExternalPursuitActionResult,
  ExternalPursuitBoardRecord,
  ExternalPursuitContactInput,
  ExternalPursuitInput,
  ExternalPursuitUpdateInput,
  ExternalPursuitStage,
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

function numberOrNull(value: number | null | undefined) {
  return value === undefined || value === null ? null : value
}

function validOptionalMetric(value: number | null | undefined) {
  return value === undefined || value === null || (Number.isFinite(value) && value >= 0)
}

function validOptionalExternalUrl(value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === "") return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
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
  idempotencyKey: string = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    if (!validOptionalDate(input.dueAt)) return { success: false, message: "Due date must use a valid YYYY-MM-DD date." }
    if (![input.revenueMeur, input.ebitdaKeur, input.headcount].every(validOptionalMetric)) return { success: false, message: "External metrics must be zero or greater." }
    if (input.headcount !== undefined && input.headcount !== null && !Number.isInteger(input.headcount)) return { success: false, message: "Headcount must be a whole number." }
    if (!validOptionalExternalUrl(input.externalUrl)) return { success: false, message: "External URL must start with http:// or https://." }
    const ownerRepreneurId =
      access.role === "staff" ? input.ownerRepreneurId : access.repreneurId
    if (!ownerRepreneurId) return { success: false, message: "Choose the dossier owner." }
    const { data, error } = await createAdminClient().rpc("create_external_pursuit_v2", {
      p_owner_repreneur_id: ownerRepreneurId,
      p_title: input.title,
      p_stage: input.stage ?? "identified",
      p_availability: input.availability ?? "unknown",
      p_due_at: dateOrNull(input.dueAt),
      p_shared_notes: input.sharedNotes ?? null,
      p_staff_internal_notes: access.role === "staff" ? input.staffInternalNotes ?? null : null,
      p_external_url: input.externalUrl ?? null,
      p_target_company: input.targetCompany ?? null,
      p_source_channel: input.sourceChannel ?? null,
      p_revenue_meur: numberOrNull(input.revenueMeur),
      p_ebitda_keur: numberOrNull(input.ebitdaKeur),
      p_headcount: numberOrNull(input.headcount),
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
  idempotencyKey: string = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    if (!validOptionalDate(input.dueAt)) return { success: false, message: "Due date must use a valid YYYY-MM-DD date." }
    if (![input.revenueMeur, input.ebitdaKeur, input.headcount].every(validOptionalMetric)) return { success: false, message: "External metrics must be zero or greater." }
    if (input.headcount !== undefined && input.headcount !== null && !Number.isInteger(input.headcount)) return { success: false, message: "Headcount must be a whole number." }
    if (!validOptionalExternalUrl(input.externalUrl)) return { success: false, message: "External URL must start with http:// or https://." }
    const { error } = await createAdminClient().rpc("update_external_pursuit_v2", {
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
      p_external_url: input.externalUrl ?? null,
      p_external_url_provided: input.externalUrl !== undefined,
      p_target_company: input.targetCompany ?? null,
      p_target_company_provided: input.targetCompany !== undefined,
      p_source_channel: input.sourceChannel ?? null,
      p_source_channel_provided: input.sourceChannel !== undefined,
      p_revenue_meur: numberOrNull(input.revenueMeur),
      p_revenue_meur_provided: input.revenueMeur !== undefined,
      p_ebitda_keur: numberOrNull(input.ebitdaKeur),
      p_ebitda_keur_provided: input.ebitdaKeur !== undefined,
      p_headcount: numberOrNull(input.headcount),
      p_headcount_provided: input.headcount !== undefined,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    return error ? { success: false, message: message(error, "Could not update External Pursuit.") } : { success: true, message: "External Pursuit updated.", pursuitId }
  } catch (error) {
    return { success: false, message: message(error, "Could not update External Pursuit.") }
  }
}

export async function moveExternalPursuitStage(
  pursuitId: string,
  stage: ExternalPursuitStage,
  idempotencyKey: string = randomUUID(),
): Promise<ExternalPursuitActionResult> {
  try {
    const access = await currentActor()
    const { error } = await createAdminClient().rpc("move_external_pursuit_stage", {
      p_dossier_id: pursuitId,
      p_stage: stage,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    return error
      ? { success: false, message: message(error, "Could not move External Pursuit.") }
      : { success: true, message: "External Pursuit stage updated.", pursuitId }
  } catch (error) {
    return { success: false, message: message(error, "Could not move External Pursuit.") }
  }
}

/** Server-only board projection. The database rejects another owner's dossier. */
export async function listExternalPursuitBoard(): Promise<ExternalPursuitBoardRecord[]> {
  const access = await currentActor()
  const { data, error } = await createAdminClient().rpc("external_pursuit_board_for_actor", {
    p_actor_user_id: access.user.id,
  })
  if (error) throw new Error(message(error, "Could not load External Pursuits."))
  type BoardContactRow = { id: string; name?: string | null; organisation?: string | null; role_title?: string | null; email?: string | null; phone?: string | null }
  type BoardRow = { id: string; owner_repreneur_id: string; owner_name?: string | null; title: string; stage: ExternalPursuitBoardRecord["stage"]; availability: ExternalPursuitBoardRecord["availability"]; deletion_status: ExternalPursuitBoardRecord["deletionStatus"]; external_url?: string | null; target_company?: string | null; source_channel?: string | null; revenue_meur?: number | string | null; ebitda_keur?: number | string | null; headcount?: number | string | null; contacts?: BoardContactRow[]; updated_at: string }
  return ((Array.isArray(data) ? data : []) as BoardRow[]).map((row) => ({
    id: row.id,
    ownerRepreneurId: row.owner_repreneur_id,
    ownerName: row.owner_name ?? null,
    title: row.title,
    stage: row.stage,
    availability: row.availability,
    deletionStatus: row.deletion_status,
    externalUrl: row.external_url ?? null,
    targetCompany: row.target_company ?? null,
    sourceChannel: row.source_channel ?? null,
    revenueMeur: row.revenue_meur === null || row.revenue_meur === undefined ? null : Number(row.revenue_meur),
    ebitdaKeur: row.ebitda_keur === null || row.ebitda_keur === undefined ? null : Number(row.ebitda_keur),
    headcount: row.headcount === null || row.headcount === undefined ? null : Number(row.headcount),
    contacts: (Array.isArray(row.contacts) ? row.contacts : []).map((contact: BoardContactRow) => ({
      id: contact.id,
      name: contact.name ?? null,
      organisation: contact.organisation ?? null,
      roleTitle: contact.role_title ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
    })),
    updatedAt: row.updated_at,
  })) as ExternalPursuitBoardRecord[]
}

export async function saveExternalPursuitContact(
  pursuitId: string,
  input: ExternalPursuitContactInput,
  idempotencyKey: string = randomUUID(),
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
  idempotencyKey: string = randomUUID(),
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
  idempotencyKey: string = randomUUID(),
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
