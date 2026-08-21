"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { queueM2RepreneurEvent } from "@/lib/telemetry/m2-repreneur"
import type { OpportunityDeclineReasonCategory, OpportunityMatchStatus } from "@/lib/types/opportunity"

const REPRENEUR_RESPONSE_ALLOWED_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined"]
const DECLINE_REASON_CATEGORIES = new Set<OpportunityDeclineReasonCategory>([
  "geography",
  "sector",
  "size_metrics",
  "business_model",
  "other",
])

type RepreneurOpportunityDeclineActionState =
  | { status: "idle"; message: "" }
  | { status: "error"; message: string }

class RepreneurOpportunityResponseError extends Error {}

function readDeclineReasonCategories(formData?: FormData): OpportunityDeclineReasonCategory[] {
  if (!formData) return []
  return formData
    .getAll("decline_reason_categories")
    .filter((value): value is OpportunityDeclineReasonCategory =>
      typeof value === "string" && DECLINE_REASON_CATEGORIES.has(value as OpportunityDeclineReasonCategory)
    )
}

function readDeclineReasonText(formData?: FormData) {
  if (!formData) return null
  const value = formData.get("decline_reason_text")
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function updateMyOpportunityResponse(
  matchId: string,
  status: "interested" | "declined",
  access: Awaited<ReturnType<typeof requirePortalAccess>>,
  formData?: FormData,
) {
  if (!access.repreneurId) throw new Error("No linked repreneur profile")

  const supabase = createAdminClient()
  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity_id, status, opportunity:opportunities!inner(status)")
    .eq("id", matchId)
    .eq("repreneur_id", access.repreneurId)
    .maybeSingle()

  if (matchError) throw new Error(matchError.message)
  const opportunity = Array.isArray(match?.opportunity) ? match.opportunity[0] : match?.opportunity
  if (!match || opportunity?.status !== "active") {
    throw new RepreneurOpportunityResponseError("This opportunity is no longer available for your response.")
  }
  if (!REPRENEUR_RESPONSE_ALLOWED_STATUSES.includes(match.status as OpportunityMatchStatus)) {
    throw new RepreneurOpportunityResponseError("This opportunity response can no longer be changed.")
  }

  const declineReasonCategories = status === "declined" ? readDeclineReasonCategories(formData) : []
  const declineReasonText = status === "declined" ? readDeclineReasonText(formData) : null

  if (status === "declined" && declineReasonCategories.length === 0) {
    throw new RepreneurOpportunityResponseError("Choose at least one reason before marking this opportunity as not a fit.")
  }

  if (status === "declined" && !declineReasonText) {
    throw new RepreneurOpportunityResponseError("Add a written rationale before marking this opportunity as not a fit.")
  }

  const { error } = await supabase
    .from("opportunity_matches")
    .update({
      status,
      decline_reason_categories: status === "declined" ? declineReasonCategories : [],
      decline_reason_text: status === "declined" ? declineReasonText : null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", matchId)
    .eq("repreneur_id", access.repreneurId)

  if (error) throw new Error(error.message)

  return { opportunityId: match.opportunity_id, userId: access.user?.id ?? "" }
}

function refreshMyOpportunityResponse(matchId: string, opportunityId: string) {
  revalidatePath("/portal/deals")
  revalidatePath(`/portal/deals/${matchId}`)
  revalidatePath("/opportunities/reviews")
  revalidatePath(`/opportunities/${opportunityId}`)
}

export async function markMyOpportunityInterested(matchId: string) {
  const access = await requirePortalAccess()
  let result: { opportunityId: string; userId: string }
  try {
    result = await updateMyOpportunityResponse(matchId, "interested", access)
  } catch (error) {
    queueM2RepreneurEvent({
      userId: access.user?.id ?? "",
      routeTemplate: "/portal/deals/:matchId",
      workflow: "portal_deals",
      action: "express_interest",
      outcome: error instanceof RepreneurOpportunityResponseError ? "validation_error" : "failure",
      errorCode: error instanceof RepreneurOpportunityResponseError ? "validation_failed" : "persistence_failed",
    })
    throw error
  }
  queueM2RepreneurEvent({
    userId: result.userId,
    routeTemplate: "/portal/deals/:matchId",
    workflow: "portal_deals",
    action: "express_interest",
    outcome: "success",
  })
  refreshMyOpportunityResponse(matchId, result.opportunityId)
  redirect("/portal/deals")
}

export async function declineMyOpportunity(
  matchId: string,
  _previousState: RepreneurOpportunityDeclineActionState,
  formData: FormData,
): Promise<RepreneurOpportunityDeclineActionState> {
  const access = await requirePortalAccess()
  let result: { opportunityId: string; userId: string }

  try {
    result = await updateMyOpportunityResponse(matchId, "declined", access, formData)
  } catch (error) {
    queueM2RepreneurEvent({
      userId: access.user?.id ?? "",
      routeTemplate: "/portal/deals/:matchId",
      workflow: "portal_deals",
      action: "decline",
      outcome: error instanceof RepreneurOpportunityResponseError ? "validation_error" : "failure",
      errorCode: error instanceof RepreneurOpportunityResponseError ? "validation_failed" : "persistence_failed",
    })
    if (error instanceof RepreneurOpportunityResponseError) {
      return { status: "error", message: error.message }
    }

    console.error("Failed to mark repreneur opportunity as not a fit", error)
    return {
      status: "error",
      message: "We could not save your response right now. Please try again.",
    }
  }

  queueM2RepreneurEvent({
    userId: result.userId,
    routeTemplate: "/portal/deals/:matchId",
    workflow: "portal_deals",
    action: "decline",
    outcome: "success",
  })
  refreshMyOpportunityResponse(matchId, result.opportunityId)
  redirect("/portal/deals")
}
