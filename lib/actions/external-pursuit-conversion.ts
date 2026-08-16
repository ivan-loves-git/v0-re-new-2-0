"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ExternalPursuitConversionInput,
  ExternalPursuitConversionResult,
  ExternalPursuitDeletionPreflightResult,
} from "@/lib/types/external-pursuit-conversion"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fieldErrors(input: ExternalPursuitConversionInput) {
  const errors: Record<string, string> = {}
  if (!input.publicTitle?.trim()) errors.publicTitle = "Write a safe anonymous public title."
  else if (input.publicTitle.trim().length > 240) errors.publicTitle = "Keep the public title under 240 characters."
  if (!UUID_PATTERN.test(input.geographyNodeId ?? "")) errors.geographyNodeId = "Choose the canonical geography."
  if (!UUID_PATTERN.test(input.sourceOfficeId ?? "")) errors.sourceOfficeId = "Choose an active real operating office."
  if (!UUID_PATTERN.test(input.primaryAffiliationId ?? "")) errors.primaryAffiliationId = "Choose one named primary contact at that office."
  return errors
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message)
  }
  return ""
}

function isAmbiguousTransportError(error: unknown) {
  const candidate = error as { status?: unknown; code?: unknown }
  const message = errorMessage(error)
  return candidate?.status === 0 || candidate?.code === "0" ||
    /failed to fetch|fetch failed|network|socket|connection|timed?\s*out/i.test(message)
}

function ambiguousResult(): ExternalPursuitConversionResult {
  return {
    success: false,
    ambiguous: true,
    message: "WAVE could not confirm whether the Draft was created. Keep these fields locked and retry this exact request.",
  }
}

function readableError(error: unknown) {
  const message = errorMessage(error)
  if (message.includes("external_pursuit_already_converted")) return "This dossier was already converted. Refresh the board to open the linked opportunity."
  if (message.includes("external_pursuit_conversion_requires_active_dossier")) return "Only an active, unfinished External Pursuit can be converted."
  if (message.includes("external_pursuit_conversion_rejects_acme_source")) return "Choose a real operating office; the provisional Acme source cannot be used."
  if (message.includes("external_pursuit_conversion_requires_active_real_office")) return "Choose an active real operating office."
  if (message.includes("external_pursuit_conversion_requires_active_named_primary_contact")) return "Choose one active named primary contact at the selected office."
  if (message.includes("opportunity_geography")) return "Choose a current canonical geography."
  return "The conversion was rejected. Review the required fields and retry."
}

function readableDeletionPreflightError(error: unknown) {
  const message = errorMessage(error)
  if (message.includes("external_pursuit_already_converted")) {
    return "This dossier is linked to a Re-New opportunity. No attachment was removed."
  }
  if (message.includes("External Pursuit deletion was not requested")) {
    return "The owner has not requested deletion. No attachment was removed."
  }
  return "WAVE could not confirm deletion eligibility. No attachment should be removed."
}

export async function convertExternalPursuitToOpportunity(
  pursuitId: string,
  input: ExternalPursuitConversionInput,
  idempotencyKey: string,
): Promise<ExternalPursuitConversionResult> {
  const errors = fieldErrors(input)
  if (!UUID_PATTERN.test(pursuitId)) {
    return { success: false, message: "This External Pursuit is no longer available.", fieldErrors: { form: "This External Pursuit is no longer available." } }
  }
  if (Object.keys(errors).length > 0) {
    return { success: false, message: "Complete the required conversion details.", fieldErrors: errors }
  }
  if (!idempotencyKey?.trim()) {
    return { success: false, message: "This conversion request is missing its retry key. Reload the dossier and try again." }
  }

  const { user } = await requireStaffAccess()
  try {
    const { data, error } = await createAdminClient().rpc(
      "convert_external_pursuit_to_opportunity",
      {
        p_dossier_id: pursuitId,
        p_public_title: input.publicTitle.trim(),
        p_geography_node_id: input.geographyNodeId,
        p_source_office_id: input.sourceOfficeId,
        p_primary_affiliation_id: input.primaryAffiliationId,
        p_actor_user_id: user.id,
        p_idempotency_key: idempotencyKey.trim(),
      },
    )
    if (error) {
      return isAmbiguousTransportError(error)
        ? ambiguousResult()
        : { success: false, message: readableError(error) }
    }
    const conversion = Array.isArray(data) ? data[0] : data
    if (!conversion?.opportunity_id || !conversion?.opportunity_reference) {
      return ambiguousResult()
    }
    revalidatePath("/opportunities")
    revalidatePath(`/opportunities/${conversion.opportunity_id}`)
    revalidatePath("/opportunities/pursuits")
    return {
      success: true,
      message: `Draft ${conversion.opportunity_reference} was created. It is staff-only and has no match or pursuit yet.`,
      opportunityId: conversion.opportunity_id,
      opportunityReference: conversion.opportunity_reference,
    }
  } catch {
    return ambiguousResult()
  }
}

/**
 * W-108 must call this before deleting any attachment object. A successful
 * result proves the durable delete-requested state won the shared dossier lock,
 * so conversion cannot begin after the preflight transaction releases it.
 */
export async function preflightExternalPursuitDeletionFulfillment(
  pursuitId: string,
): Promise<ExternalPursuitDeletionPreflightResult> {
  if (!UUID_PATTERN.test(pursuitId)) {
    return { success: false, message: "This External Pursuit is no longer available." }
  }
  const { user } = await requireStaffAccess()
  try {
    const { error } = await createAdminClient().rpc(
      "prepare_external_pursuit_deletion_fulfillment",
      { p_dossier_id: pursuitId, p_actor_user_id: user.id },
    )
    if (error) return { success: false, message: readableDeletionPreflightError(error) }
    return { success: true, message: "Deletion fulfillment is ready." }
  } catch {
    return {
      success: false,
      message: "WAVE could not confirm deletion eligibility. No attachment should be removed.",
    }
  }
}
