"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { bookingReminderDueOn } from "@/lib/booking-request-reminder"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"

export type BookingRequestEvent = {
  id: string
  repreneur_id: string
  sent_at: string
  recorded_at: string
  recorded_by: string
}

export async function recordBookingRequestSent(input: {
  repreneurId: string
  sentAt: string
  idempotencyKey: string
}) {
  const { user } = await requireStaffAccess()
  const sentAt = new Date(input.sentAt)
  if (!isUuid(input.repreneurId) || !isUuid(input.idempotencyKey) || !Number.isFinite(sentAt.getTime())) throw new Error("Choose a valid profile, sent time and request key.")
  if (sentAt.getTime() > Date.now()) throw new Error("The Outlook invitation cannot be recorded in the future.")
  const { data, error } = await createAdminClient().rpc("record_repreneur_booking_request_sent", {
    p_repreneur_id: input.repreneurId,
    p_sent_at: sentAt.toISOString(),
    p_recorded_by: user.id,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error || !data) throw new Error("Could not record the Outlook invitation.")
  revalidatePath(`/repreneurs/${input.repreneurId}`)
  return { event: data as BookingRequestEvent, reminderDueOn: bookingReminderDueOn((data as BookingRequestEvent).sent_at) }
}

export async function getLatestBookingRequestEvent(repreneurId: string) {
  await requireStaffAccess()
  const { data, error } = await createAdminClient()
    .from("repreneur_booking_request_events")
    .select("id, repreneur_id, sent_at, recorded_at, recorded_by")
    .eq("repreneur_id", repreneurId)
    .order("sent_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error("Could not read the Outlook invitation record.")
  return data as BookingRequestEvent | null
}
