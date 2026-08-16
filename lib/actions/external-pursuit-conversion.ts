"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ExternalPursuitConversionInput,
  ExternalPursuitConversionResult,
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

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (message.includes("external_pursuit_already_converted")) return "This dossier was already converted. Refresh the board to open the linked opportunity."
  if (message.includes("external_pursuit_conversion_requires_active_dossier")) return "Only an active, unfinished External Pursuit can be converted."
  if (message.includes("external_pursuit_conversion_rejects_acme_source")) return "Choose a real operating office; the provisional Acme source cannot be used."
  if (message.includes("external_pursuit_conversion_requires_active_real_office")) return "Choose an active real operating office."
  if (message.includes("external_pursuit_conversion_requires_active_named_primary_contact")) return "Choose one active named primary contact at the selected office."
  if (message.includes("opportunity_geography")) return "Choose a current canonical geography."
  return "The dossier could not be converted. Nothing was created; review the required fields and retry."
}

export async function convertExternalPursuitToOpportunity(
  pursuitId: string,
  input: ExternalPursuitConversionInput,
  idempotencyKey: string = randomUUID(),
): Promise<ExternalPursuitConversionResult> {
  const errors = fieldErrors(input)
  if (!UUID_PATTERN.test(pursuitId)) {
    return { success: false, message: "This External Pursuit is no longer available.", fieldErrors: { form: "This External Pursuit is no longer available." } }
  }
  if (Object.keys(errors).length > 0) {
    return { success: false, message: "Complete the required conversion details.", fieldErrors: errors }
  }

  try {
    const { user } = await requireStaffAccess()
    const { data, error } = await createAdminClient().rpc(
      "convert_external_pursuit_to_opportunity",
      {
        p_dossier_id: pursuitId,
        p_public_title: input.publicTitle.trim(),
        p_geography_node_id: input.geographyNodeId,
        p_source_office_id: input.sourceOfficeId,
        p_primary_affiliation_id: input.primaryAffiliationId,
        p_actor_user_id: user.id,
        p_idempotency_key: idempotencyKey,
      },
    )
    if (error) throw new Error(error.message)
    const conversion = Array.isArray(data) ? data[0] : data
    if (!conversion?.opportunity_id || !conversion?.opportunity_reference) {
      return { success: false, message: "The conversion result could not be confirmed. Refresh before retrying with the same request." }
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
  } catch (error) {
    return { success: false, message: readableError(error) }
  }
}
