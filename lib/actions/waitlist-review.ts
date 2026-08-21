"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const waitlistIdSchema = z.string().uuid()
const WAITLIST_NOT_FOUND = "This access request could not be found. Refresh the list and try again."

function friendlyPromotionError(message?: string) {
  if (!message) return "This access request could not be approved. Refresh the list and try again."
  if (/access request was not found|invalid input syntax for type uuid/i.test(message)) {
    return WAITLIST_NOT_FOUND
  }
  if (/both first and last name are required/i.test(message)) {
    return "Enter both first and last name to create a new Repreneur profile."
  }
  if (/seller access requests cannot be promoted/i.test(message)) {
    return "Seller requests cannot be added to the Repreneur pipeline."
  }
  if (/no usable email address/i.test(message)) {
    return "This request has no usable email address and cannot be linked."
  }
  return "This access request could not be approved. Refresh the list and try again."
}

export interface WaitlistReviewRequest {
  id: string
  name: string
  email: string
  role: "repreneur" | "seller"
  status: "pending" | "approved" | "rejected"
  createdAt: string
  promotedRepreneurId: string | null
}

export async function getWaitlistReviewRequests(search = ""): Promise<WaitlistReviewRequest[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("waitlist")
    .select("id, name, email, role, status, created_at, promoted_repreneur_id")
    .order("created_at", { ascending: false })

  if (error) throw new Error("Access requests could not be loaded.")
  const needle = search.trim().toLocaleLowerCase()
  return (data ?? [])
    .filter((row) => !needle || `${row.name} ${row.email}`.toLocaleLowerCase().includes(needle))
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      promotedRepreneurId: row.promoted_repreneur_id,
    }))
}

export async function promoteWaitlistRepreneur(
  waitlistId: string,
  firstName: string,
  lastName: string,
) {
  if (!waitlistIdSchema.safeParse(waitlistId).success) {
    return { ok: false as const, message: WAITLIST_NOT_FOUND }
  }

  const normalizedFirstName = firstName.trim()
  const normalizedLastName = lastName.trim()

  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("promote_waitlist_repreneur", {
    p_waitlist_id: waitlistId,
    p_first_name: normalizedFirstName,
    p_last_name: normalizedLastName,
    p_actor_user_id: user.id,
  })

  if (error || typeof data !== "string") {
    return { ok: false as const, message: friendlyPromotionError(error?.message) }
  }

  revalidatePath("/access-requests")
  revalidatePath("/repreneurs")
  return { ok: true as const, repreneurId: data, href: `/repreneurs/${data}` }
}
