"use server"

import { revalidatePath } from "next/cache"
import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import type { RepreneurPersonalReview } from "@/lib/types/opportunity"

export type PersonalReviewResult =
  | { ok: true; state: RepreneurPersonalReview }
  | { ok: false; message: string }

async function saveReview(
  opportunityId: string,
  reviewed: boolean | null,
  expectedReviewed: boolean | null,
): Promise<PersonalReviewResult> {
  const access = await requirePortalAccess()
  if (access.role !== "repreneur" || !access.repreneurId || !isUuid(opportunityId)) {
    return { ok: false, message: "This opportunity is no longer available." }
  }
  try {
    const { data, error } = await createAdminClient().rpc("record_repreneur_opportunity_review", {
      p_repreneur_id: access.repreneurId,
      p_opportunity_id: opportunityId,
      p_reviewed: reviewed,
      p_expected_reviewed: expectedReviewed,
    })
    if (error || !data?.[0]) {
      if (error?.message?.includes("review_state_changed")) {
        return { ok: false, message: "Your review changed in another session. Refresh before trying again." }
      }
      return { ok: false, message: "Your review status could not be saved. Please try again." }
    }
    revalidatePath("/portal/deals", "layout")
    return { ok: true, state: { viewed: true, reviewed: data[0].reviewed === true } }
  } catch {
    return { ok: false, message: "Your review status could not be saved. Please try again." }
  }
}

/** Called from a mounted, visible authorized detail, never from a GET or prefetch. */
export async function recordMyOpportunityViewed(opportunityId: string): Promise<PersonalReviewResult> {
  return saveReview(opportunityId, null, null)
}

export async function setMyOpportunityReviewed(
  opportunityId: string, reviewed: boolean, expectedReviewed: boolean,
): Promise<PersonalReviewResult> {
  if (typeof reviewed !== "boolean" || typeof expectedReviewed !== "boolean") {
    return { ok: false, message: "Choose a valid review action." }
  }
  return saveReview(opportunityId, reviewed, expectedReviewed)
}
