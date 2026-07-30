import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { MaContactEmailPurpose } from "@/lib/ma-contact-email-policy"

interface AuthorizeMaContactEmailSendInput {
  contactId: string
  opportunityId: string | null
  purpose: MaContactEmailPurpose
  actor: string
  operationKey: string
}

export async function isMaContactEmailAddressSuppressed(email: string) {
  const normalizedEmail = email.trim()
  if (!normalizedEmail) return false

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "ma_contact_email_address_is_suppressed",
    {
      p_email: normalizedEmail,
    },
  )

  // A policy lookup failure must block generic/manual sends rather than turn
  // an unavailable safety boundary into permission.
  if (error) {
    throw new Error("M&A contact email policy could not be verified.")
  }
  return data === true
}

export async function getSuppressedMaContactEmailAddresses() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ma_contacts")
    .select("email")
    .eq("campaign_email_suppressed", true)
    .not("email", "is", null)

  if (error) {
    throw new Error("M&A contact email policy could not be verified.")
  }

  return new Set(
    (data ?? [])
      .map((contact) => contact.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  )
}

export async function authorizeMaContactEmailSend(
  input: AuthorizeMaContactEmailSendInput,
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "authorize_ma_contact_email_send",
    {
      p_contact_id: input.contactId,
      p_opportunity_id: input.opportunityId,
      p_purpose: input.purpose,
      p_actor: input.actor,
      p_operation_key: input.operationKey,
    },
  )

  if (error || data !== true) {
    const code = error?.message ?? ""
    if (code.includes("ma_contact_campaign_email_suppressed")) {
      return {
        allowed: false,
        message:
          "Email blocked because this contact has opted out of campaign and general outreach.",
      }
    }
    if (code.includes("ma_contact_email_purpose_or_link_not_authorized")) {
      return {
        allowed: false,
        message:
          "Email blocked because this purpose is not allowed for the selected opportunity contact.",
      }
    }
    return {
      allowed: false,
      message:
        "Email blocked because the contact email policy could not be verified.",
    }
  }

  return { allowed: true, message: "" }
}
