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

const CONVERSION_DOMAIN_ERRORS = [
  [
    "external_pursuit_already_converted",
    "This dossier was already converted. Refresh the board to open the linked opportunity.",
  ],
  [
    "external_pursuit_conversion_requires_active_dossier",
    "Only an active, unfinished External Pursuit can be converted.",
  ],
  [
    "external_pursuit_conversion_rejects_acme_source",
    "Choose a real operating office; the provisional Acme source cannot be used.",
  ],
  [
    "external_pursuit_conversion_requires_active_real_office",
    "Choose an active real operating office.",
  ],
  [
    "external_pursuit_conversion_requires_active_named_primary_contact",
    "Choose one active named primary contact at the selected office.",
  ],
  ["external_pursuit_conversion_fields_required", "Complete every required conversion field."],
  [
    "external_pursuit_conversion_public_title_too_long",
    "Keep the public title under 240 characters.",
  ],
  [
    "external_pursuit_conversion_actor_and_key_required",
    "This conversion request is missing its staff identity or retry key.",
  ],
  ["opportunity_geography_required", "Choose a current canonical geography."],
  ["opportunity_geography_not_found", "Choose a current canonical geography."],
  ["External Pursuit access denied.", "Staff access is required to convert this dossier."],
] as const

function fieldErrors(input: ExternalPursuitConversionInput) {
  const errors: Record<string, string> = {}
  if (!input.publicTitle?.trim()) errors.publicTitle = "Write a safe anonymous public title."
  else if (input.publicTitle.trim().length > 240) errors.publicTitle = "Keep the public title under 240 characters."
  if (!UUID_PATTERN.test(input.geographyNodeId ?? "")) errors.geographyNodeId = "Choose the canonical geography."
  if (!UUID_PATTERN.test(input.sourceOfficeId ?? "")) errors.sourceOfficeId = "Choose an active real operating office."
  if (!UUID_PATTERN.test(input.primaryAffiliationId ?? "")) errors.primaryAffiliationId = "Choose one named primary contact at that office."
  if (typeof input.isDemo !== "boolean") errors.classification = "Choose REAL or DEMO before creating this record."
  return errors
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message)
  }
  return ""
}

function ambiguousResult(): ExternalPursuitConversionResult {
  return {
    success: false,
    ambiguous: true,
    message: "WAVE could not confirm whether the Draft was created. Keep these fields locked and retry this exact request.",
  }
}

function readableConversionDomainError(error: unknown): string | null {
  const message = errorMessage(error)
  return CONVERSION_DOMAIN_ERRORS.find(([token]) => message.includes(token))?.[1] ?? null
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
    const { data, error, status } = await createAdminClient().rpc(
      "convert_external_pursuit_to_opportunity",
      {
        p_dossier_id: pursuitId,
        p_public_title: input.publicTitle.trim(),
        p_geography_node_id: input.geographyNodeId,
        p_source_office_id: input.sourceOfficeId,
        p_primary_affiliation_id: input.primaryAffiliationId,
        p_is_demo: input.isDemo,
        p_actor_user_id: user.id,
        p_idempotency_key: idempotencyKey.trim(),
      },
    )
    // PostgREST exposes transport status beside the error object. Status zero
    // means the client never received a trustworthy commit outcome.
    if (status === 0) return ambiguousResult()
    if (error) {
      const domainMessage = readableConversionDomainError(error)
      return domainMessage
        ? { success: false, message: domainMessage }
        : ambiguousResult()
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

/** Staff board mount guard. The panel itself still relies on the atomic RPC. */
export async function listUnconvertedExternalPursuitIds(
  pursuitIds: string[],
): Promise<string[]> {
  await requireStaffAccess()
  const uniqueIds = [...new Set(pursuitIds.filter((id) => UUID_PATTERN.test(id)))]
  if (uniqueIds.length === 0) return []
  const { data, error } = await createAdminClient()
    .from("external_pursuit_opportunity_conversions")
    .select("external_pursuit_id")
    .in("external_pursuit_id", uniqueIds)
  if (error) throw new Error("Could not determine External Pursuit conversion state.")
  const converted = new Set((data ?? []).map((row) => row.external_pursuit_id))
  return uniqueIds.filter((id) => !converted.has(id))
}
