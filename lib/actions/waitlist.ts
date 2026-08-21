"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { validateWaitlistRequest } from "@/lib/waitlist-input"

type WaitlistResult =
  | { success: true }
  | { success: false; error: string }

export async function submitWaitlistRequest(
  name: string,
  email: string,
  role: "repreneur" | "seller"
): Promise<WaitlistResult> {
  const validated = validateWaitlistRequest(name, email, role)
  if (!validated.success) return validated
  const input = validated.data

  const supabase = createAdminClient()

  // Check if email already exists
  const { data: existing } = await supabase
    .from("waitlist")
    .select("id")
    .eq("email", input.email)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: "This email is already on our waitlist. We'll be in touch soon!",
    }
  }

  const { error } = await supabase.from("waitlist").insert({
    ...input,
  })

  if (error?.code === "23505") {
    return {
      success: false,
      error: "This email is already on our waitlist. We'll be in touch soon!",
    }
  }

  if (error) {
    console.error("[Waitlist] Insert error:", error)
    return { success: false, error: "Something went wrong. Please try again." }
  }

  return { success: true }
}
