"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"

export type RenewOpportunityRecommendationState =
  | { status: "idle"; message: "" }
  | { status: "success"; message: string }
  | { status: "error"; message: string }

export async function renewOpportunityRecommendationAction(
  _previousState: RenewOpportunityRecommendationState,
  formData: FormData,
): Promise<RenewOpportunityRecommendationState> {
  const access = await requireStaffAccess()
  const matchId = formData.get("match_id")
  if (typeof matchId !== "string" || !isUuid(matchId)) {
    return { status: "error", message: "This recommendation is not available for renewal." }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("renew_opportunity_recommendation", {
    p_match_id: matchId,
    p_actor: access.user.id,
  })
  if (error) {
    return { status: "error", message: "The recommendation could not be renewed. Refresh the page and try again." }
  }

  revalidatePath("/portal/deals")
  revalidatePath(`/portal/deals/${matchId}`)
  revalidatePath("/portal-preview")
  revalidatePath("/opportunities", "layout")
  revalidatePath("/repreneurs", "layout")
  return { status: "success", message: "The 72-hour recommendation response window was renewed." }
}
