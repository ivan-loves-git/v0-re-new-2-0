"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
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

async function updateMyOpportunityResponse(matchId: string, status: "interested" | "declined", formData?: FormData) {
  const access = await requirePortalAccess()
  if (!access.repreneurId) throw new Error("No linked repreneur profile")

  const supabase = createAdminClient()
  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity_id, status")
    .eq("id", matchId)
    .eq("repreneur_id", access.repreneurId)
    .maybeSingle()

  if (matchError) throw new Error(matchError.message)
  if (!match) throw new RepreneurOpportunityResponseError("This opportunity is no longer available for your response.")
  if (!REPRENEUR_RESPONSE_ALLOWED_STATUSES.includes(match.status as OpportunityMatchStatus)) {
    throw new RepreneurOpportunityResponseError("This opportunity response can no longer be changed.")
  }

  const declineReasonCategories = status === "declined" ? readDeclineReasonCategories(formData) : []
  const declineReasonText = status === "declined" ? readDeclineReasonText(formData) : null

  if (status === "declined" && declineReasonCategories.length === 0) {
    throw new RepreneurOpportunityResponseError("Choose at least one reason before marking this opportunity as not a fit.")
  }

  if (status === "declined" && declineReasonCategories.includes("other") && !declineReasonText) {
    throw new RepreneurOpportunityResponseError("Add details when selecting Other.")
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

  return match.opportunity_id
}

function refreshMyOpportunityResponse(matchId: string, opportunityId: string) {
  revalidatePath("/portal/deals")
  revalidatePath(`/portal/deals/${matchId}`)
  revalidatePath("/opportunities/reviews")
  revalidatePath(`/opportunities/${opportunityId}`)
}

export async function markMyOpportunityInterested(matchId: string) {
  const opportunityId = await updateMyOpportunityResponse(matchId, "interested")
  refreshMyOpportunityResponse(matchId, opportunityId)
  redirect("/portal/deals")
}

export async function declineMyOpportunity(
  matchId: string,
  _previousState: RepreneurOpportunityDeclineActionState,
  formData: FormData,
): Promise<RepreneurOpportunityDeclineActionState> {
  let opportunityId: string

  try {
    opportunityId = await updateMyOpportunityResponse(matchId, "declined", formData)
  } catch (error) {
    if (error instanceof RepreneurOpportunityResponseError) {
      return { status: "error", message: error.message }
    }

    console.error("Failed to mark repreneur opportunity as not a fit", error)
    return {
      status: "error",
      message: "We could not save your response right now. Please try again.",
    }
  }

  refreshMyOpportunityResponse(matchId, opportunityId)
  redirect("/portal/deals")
}
