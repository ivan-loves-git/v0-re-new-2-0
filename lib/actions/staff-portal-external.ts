"use server"

import { requireStaffAccess } from "@/lib/access-control"
import {
  createExternalPursuit, moveExternalPursuitStage, saveExternalPursuitContact,
  updateExternalPursuit, updateExternalPursuitFollowUp,
} from "@/lib/actions/external-pursuits"
import { deleteExternalPursuitAttachment } from "@/lib/actions/external-pursuit-attachments"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import type {
  ExternalPursuitContactInput, ExternalPursuitFollowUpInput, ExternalPursuitInput,
  ExternalPursuitStage, ExternalPursuitUpdateInput,
} from "@/lib/types/external-pursuit"

async function selectedOwner(ownerId: string, token: string) {
  const access = await requireStaffAccess()
  if (!isUuid(ownerId) || !verifyStaffPortalSelection(token, ownerId, access.user.id)) {
    throw new Error("The selected repreneur changed. Refresh this portal view.")
  }
  const { data, error } = await createAdminClient().from("repreneurs")
    .select("id").eq("id", ownerId).maybeSingle()
  if (error || !data) throw new Error("The selected repreneur is unavailable.")
}

async function selectedDossier(ownerId: string, token: string, pursuitId: string) {
  // Keep a local staff boundary before this helper's service-role query as
  // well as the actor-bound selected-owner check it delegates to.
  await requireStaffAccess()
  await selectedOwner(ownerId, token)
  if (!isUuid(pursuitId)) throw new Error("Invalid External Pursuit selection.")
  const { data, error } = await createAdminClient().from("external_pursuits")
    .select("id,owner_repreneur_id,deletion_status")
    .eq("id", pursuitId).eq("owner_repreneur_id", ownerId).maybeSingle()
  if (error || !data || data.owner_repreneur_id !== ownerId || data.deletion_status !== "active") {
    throw new Error("This External Pursuit is not active for the selected repreneur.")
  }
}

export async function createSelectedExternalPursuit(ownerId: string, token: string, input: ExternalPursuitInput, key: string) {
  await selectedOwner(ownerId, token)
  if (input.ownerRepreneurId !== ownerId || input.staffInternalNotes !== undefined) {
    throw new Error("This dossier must belong to the selected repreneur and cannot include staff-only notes here.")
  }
  return createExternalPursuit(input, key)
}

export async function updateSelectedExternalPursuit(ownerId: string, token: string, pursuitId: string, input: ExternalPursuitUpdateInput, key: string) {
  await selectedDossier(ownerId, token, pursuitId)
  if (input.staffInternalNotes !== undefined) throw new Error("Staff-only notes are outside this portal view.")
  return updateExternalPursuit(pursuitId, input, key)
}

export async function moveSelectedExternalPursuitStage(ownerId: string, token: string, pursuitId: string, stage: ExternalPursuitStage, key: string) {
  await selectedDossier(ownerId, token, pursuitId)
  return moveExternalPursuitStage(pursuitId, stage, key)
}

export async function saveSelectedExternalPursuitContact(ownerId: string, token: string, pursuitId: string, input: ExternalPursuitContactInput, key: string) {
  await selectedDossier(ownerId, token, pursuitId)
  return saveExternalPursuitContact(pursuitId, input, key)
}

export async function updateSelectedExternalPursuitFollowUp(ownerId: string, token: string, pursuitId: string, input: ExternalPursuitFollowUpInput, key: string) {
  await selectedDossier(ownerId, token, pursuitId)
  if (input.staffInternalNotes !== undefined) throw new Error("Staff-only notes are outside this portal view.")
  return updateExternalPursuitFollowUp(pursuitId, input, key)
}

export async function deleteSelectedExternalPursuitAttachment(ownerId: string, token: string, pursuitId: string, attachmentId: string, key: string) {
  await selectedDossier(ownerId, token, pursuitId)
  return deleteExternalPursuitAttachment(pursuitId, attachmentId, key)
}
