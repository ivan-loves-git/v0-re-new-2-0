"use server"

import { createAdminClient } from "@/lib/supabase/admin"

type WaitlistResult =
  | { success: true }
  | { success: false; error: string }

export async function submitWaitlistRequest(
  name: string,
  email: string,
  role: "repreneur" | "seller"
): Promise<WaitlistResult> {
  if (!name.trim() || !email.trim() || !role) {
    return { success: false, error: "All fields are required." }
  }

  const supabase = createAdminClient()

  // Check if email already exists
  const { data: existing } = await supabase
    .from("waitlist")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: "This email is already on our waitlist. We'll be in touch soon!",
    }
  }

  const { error } = await supabase.from("waitlist").insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    role,
  })

  if (error) {
    console.error("[Waitlist] Insert error:", error)
    return { success: false, error: "Something went wrong. Please try again." }
  }

  return { success: true }
}
