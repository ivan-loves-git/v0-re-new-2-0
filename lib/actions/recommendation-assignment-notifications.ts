"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { deliverRecommendationAssignment, type RecommendationAssignmentDeliveryResult } from "@/lib/email/recommendation-assignment-delivery"

export async function retryRecommendationAssignmentEmail(matchId: string): Promise<RecommendationAssignmentDeliveryResult> {
  const access = await requireStaffAccess()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
    return { status: "blocked", message: "Select an existing recommendation." }
  }
  // Retry can consume an existing intent, but can never create one for a
  // historical row, note edit, renewal or status cycle.
  const result = await deliverRecommendationAssignment(matchId, access.user.id)
  const { data } = await createAdminClient().from("opportunity_matches")
    .select("opportunity_id, repreneur_id").eq("id", matchId).maybeSingle()
  if (data) {
    revalidatePath(`/opportunities/${data.opportunity_id}`)
    revalidatePath(`/repreneurs/${data.repreneur_id}`)
  }
  return result
}
