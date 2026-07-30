"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

export interface MaContactEmailSuppressionResult {
  success: boolean
  message: string
}

export async function setMaContactCampaignEmailSuppression(input: {
  contactId: string
  suppressed: boolean
  reason: string
}): Promise<MaContactEmailSuppressionResult> {
  const { user } = await requireStaffAccess()
  const contactId = input.contactId.trim()
  const reason = input.reason.trim()

  if (!contactId) {
    return { success: false, message: "Choose a canonical M&A contact." }
  }
  if (reason.length < 5 || reason.length > 500) {
    return {
      success: false,
      message: "Add a clear reason between 5 and 500 characters.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc(
    "set_ma_contact_campaign_email_suppression",
    {
      p_contact_id: contactId,
      p_suppressed: input.suppressed,
      p_reason: reason,
      p_actor: user.id,
    },
  )

  if (error) {
    if (
      error.message.includes(
        "ma_contact_campaign_email_suppression_change_blocked_during_send",
      )
    ) {
      return {
        success: false,
        message:
          "Wait for the in-progress email delivery to finish before changing this contact.",
      }
    }
    if (
      error.message.includes(
        "ma_contact_campaign_email_suppression_state_unchanged",
      )
    ) {
      return {
        success: false,
        message: "The contact already has this email policy.",
      }
    }
    return {
      success: false,
      message: "The contact email policy could not be changed safely.",
    }
  }

  revalidatePath("/opportunities/ma")
  revalidatePath("/opportunities")
  return {
    success: true,
    message: input.suppressed
      ? "Campaign and general outreach are now blocked."
      : "Campaign and general outreach are allowed again.",
  }
}
