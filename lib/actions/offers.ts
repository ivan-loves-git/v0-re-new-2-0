"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { redirect } from "next/navigation"
import type { Offer_Insert, OfferStatus, MilestoneType } from "@/lib/types/offer"
import type { DeclineReasonCategory } from "@/lib/types/repreneur"
import { isDeclineReasonCategory } from "@/lib/types/repreneur"
import { sendEmail } from "@/lib/email"
import { OfferReceivedEmail } from "@/lib/email/templates/offer-received"
import { OfferAcceptedEmail } from "@/lib/email/templates/offer-accepted"
import { MilestoneCompletedEmail } from "@/lib/email/templates/milestone-completed"
import {
  deliverNotification,
  notificationIdempotencyKey,
  type NotificationDeliveryResult,
} from "@/lib/email/notification-delivery"

function notificationResult(delivery: NotificationDeliveryResult) {
  if (delivery.status === "sent") {
    return { success: true as const, resendId: delivery.providerId }
  }
  if (delivery.status === "already_sent") {
    return { success: true as const }
  }
  if (delivery.status === "busy") {
    return {
      success: false as const,
      error: "This notification is already being delivered. Refresh before retrying.",
    }
  }
  return {
    success: false as const,
    error: delivery.error ?? "The notification provider did not confirm delivery.",
  }
}

function parseOfferForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  const priceRaw = String(formData.get("price") ?? "").trim()
  const price = priceRaw ? Number(priceRaw) : Number.NaN
  const durationDays = Number(formData.get("duration_days"))

  if (!name) throw new Error("Offer name is required.")
  if (!priceRaw) throw new Error("Price is required.")
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be €0 or more.")
  if (!Number.isInteger(durationDays) || durationDays < 1) throw new Error("Duration must be at least one day.")

  const acceptanceDeadlineRaw = String(formData.get("acceptance_deadline_days") ?? "").trim()
  const includesHoursRaw = String(formData.get("includes_hours") ?? "").trim()
  const acceptanceDeadlineDays = acceptanceDeadlineRaw ? Number(acceptanceDeadlineRaw) : null
  const includesHours = includesHoursRaw ? Number(includesHoursRaw) : null
  if (acceptanceDeadlineDays !== null && (!Number.isInteger(acceptanceDeadlineDays) || acceptanceDeadlineDays < 1)) {
    throw new Error("Acceptance deadline must be at least one day.")
  }
  if (includesHours !== null && (!Number.isInteger(includesHours) || includesHours < 0)) {
    throw new Error("Coaching hours must be a whole number of zero or more.")
  }

  return { name, price, durationDays, acceptanceDeadlineDays, includesHours }
}

async function requireOwnedRepreneurOffer(
  supabase: ReturnType<typeof createAdminClient>,
  repreneurOfferId: string,
  repreneurId: string,
) {
  const { data, error } = await supabase
    .from("repreneur_offers")
    .select("id, repreneur_id, offer_id, status, accepted_at, expires_at, declined_at, offer:offers(*)")
    .eq("id", repreneurOfferId)
    .eq("repreneur_id", repreneurId)
    .single()

  if (error || !data) throw new Error("This offer no longer belongs to this repreneur. Refresh and try again.")
  return data
}

async function requireOwnedMilestone(
  supabase: ReturnType<typeof createAdminClient>,
  milestoneId: string,
  repreneurId: string,
) {
  const { data, error } = await supabase
    .from("offer_milestones")
    .select("id, is_completed, completed_at, repreneur_offer:repreneur_offers(repreneur_id)")
    .eq("id", milestoneId)
    .single()
  const offer = Array.isArray(data?.repreneur_offer) ? data.repreneur_offer[0] : data?.repreneur_offer
  if (error || !offer || offer.repreneur_id !== repreneurId) {
    throw new Error("This milestone no longer belongs to this repreneur. Refresh and try again.")
  }
  return data
}

export async function createOffer(formData: FormData) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { name, price, durationDays, acceptanceDeadlineDays, includesHours } = parseOfferForm(formData)

  const offer: Offer_Insert = {
    name,
    description: (formData.get("description") as string) || undefined,
    price,
    duration_days: durationDays,
    acceptance_deadline_days: acceptanceDeadlineDays ?? 14,
    includes_hours: includesHours ?? 0,
    includes_resources: formData.get("includes_resources") === "true",
    is_active: formData.get("is_active") !== "false",
  }

  const { error } = await supabase.from("offers").insert(offer)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
  redirect("/offers")
}

export async function updateOffer(id: string, formData: FormData) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { name, price, durationDays, acceptanceDeadlineDays, includesHours } = parseOfferForm(formData)

  const updates = {
    name,
    description: (formData.get("description") as string) || null,
    price,
    duration_days: durationDays,
    acceptance_deadline_days: acceptanceDeadlineDays,
    includes_hours: includesHours,
    includes_resources: formData.get("includes_resources") === "true",
    is_active: formData.get("is_active") === "true",
  }

  const { error } = await supabase.from("offers").update(updates).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
}

export async function toggleOfferActive(id: string, isActive: boolean) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase.from("offers").update({ is_active: isActive }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
}

export async function assignOfferToRepreneur(repreneurId: string, offerId: string) {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()

  // This RPC serializes same-offer assignments and changes the repreneur state
  // in the same transaction. A stale tab cannot send an archived offer or make
  // a second open assignment while the first request is in flight.
  const { data: createdAssignmentId, error: offerError } = await supabase.rpc("assign_repreneur_offer", {
    p_repreneur_id: repreneurId,
    p_offer_id: offerId,
    p_created_by: user.id,
  })

  let assignmentId = typeof createdAssignmentId === "string" ? createdAssignmentId : null
  if (offerError?.message === "This offer already has an open assignment for this repreneur.") {
    // The original action may have committed while its browser response was
    // lost. Rejoin that exact assignment and retry only its idempotent email.
    const { data: existing } = await supabase
      .from("repreneur_offers")
      .select("id")
      .eq("repreneur_id", repreneurId)
      .eq("offer_id", offerId)
      .in("status", ["offered", "accepted"])
      .maybeSingle()
    assignmentId = existing?.id ?? null
  } else if (offerError) {
    console.error("Database error in assignOfferToRepreneur:", offerError)
    throw new Error(offerError.message)
  }

  if (!assignmentId) throw new Error("Offer assigned, but its notification needs staff review.")

  const notification = await sendOfferReceivedNotification(supabase, assignmentId, repreneurId, offerId)

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
  revalidatePath("/repreneurs")
  revalidatePath("/pipeline")
  revalidateRepreneurDashboardTags()

  return {
    success: true as const,
    assignmentId,
    notificationSent: notification.success,
    ...(!notification.success ? { notificationError: notification.error } : {}),
  }
}

async function sendOfferReceivedNotification(
  supabase: ReturnType<typeof createAdminClient>,
  assignmentId: string,
  repreneurId: string,
  offerId: string,
) {
  const idempotencyKey = notificationIdempotencyKey.offerReceived(assignmentId)
  try {
    const delivery = await deliverNotification({
      idempotencyKey,
      send: async (claimedKey) => {
        const [{ data: currentAssignment }, { data: repreneurData }, { data: offerData }] = await Promise.all([
          supabase
            .from("repreneur_offers")
            .select("status")
            .eq("id", assignmentId)
            .eq("repreneur_id", repreneurId)
            .maybeSingle(),
          supabase.from("repreneurs").select("first_name, last_name, email").eq("id", repreneurId).single(),
          supabase.from("offers").select("name").eq("id", offerId).single(),
        ])

        if (currentAssignment?.status !== "offered") {
          return {
            success: false as const,
            error: "This offer notification is no longer applicable.",
          }
        }
        if (!repreneurData || !offerData) {
          return {
            success: false as const,
            error: "Recipient or offer details are unavailable.",
          }
        }

        return sendEmail({
          to: repreneurData.email,
          subject: `Nouvelle offre Re-New: ${offerData.name}`,
          repreneurId,
          templateKey: "offer_received",
          idempotencyKey: claimedKey,
          react: OfferReceivedEmail({
            repreneur: {
              id: repreneurId,
              firstName: repreneurData.first_name,
              lastName: repreneurData.last_name,
              email: repreneurData.email,
            },
            metadata: {
              offerName: offerData.name,
            },
          }),
        })
      },
    })
    return notificationResult(delivery)
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "The notification delivery could not be claimed.",
    }
  }
}

export async function retryOfferReceivedNotification(repreneurOfferId: string, repreneurId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const assignment = await requireOwnedRepreneurOffer(supabase, repreneurOfferId, repreneurId)
  if (assignment.status !== "offered") {
    return {
      success: false as const,
      error: "This offer notification is no longer applicable.",
    }
  }
  return sendOfferReceivedNotification(supabase, repreneurOfferId, repreneurId, assignment.offer_id)
}

export async function updateRepreneurOfferStatus(
  repreneurOfferId: string,
  newStatus: OfferStatus,
  repreneurId: string,
  declineReasonCategory?: DeclineReasonCategory,
  declineReasonText?: string,
) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  // Engagement always supplies a reason. Keep legacy timeline/activity transitions
  // compatible when they omit one, while rejecting every supplied invalid value.
  if (
    newStatus === "declined" &&
    declineReasonCategory !== undefined &&
    !isDeclineReasonCategory(declineReasonCategory)
  ) {
    throw new Error("Select a valid decline reason.")
  }

  const normalizedDeclineReasonText = declineReasonText?.trim() || null

  const isDecision = newStatus === "accepted" || newStatus === "declined"
  let acceptanceTimestamp: string | null = null

  if (isDecision) {
    // The database locks the assignment and changes both the offer and the
    // repreneur lifecycle in one transaction. A same-decision retry returns
    // the original dates; an opposite stale decision is rejected there.
    const { data, error } = await supabase.rpc("transition_repreneur_offer_decision", {
      p_repreneur_offer_id: repreneurOfferId,
      p_repreneur_id: repreneurId,
      p_new_status: newStatus,
      p_decline_reason_category: declineReasonCategory || null,
      p_decline_reason_text: normalizedDeclineReasonText,
    })
    if (error) throw new Error(error.message)
    const result = Array.isArray(data) ? data[0] : data
    if (!result || result.status !== newStatus) {
      throw new Error("The offer decision was not confirmed. Refresh and try again.")
    }
    acceptanceTimestamp = result.accepted_at ?? null
  } else {
    const updates: Record<string, unknown> = { status: newStatus }
    const { error } = await supabase
      .from("repreneur_offers")
      .update(updates)
      .eq("id", repreneurOfferId)
      .eq("repreneur_id", repreneurId)

    if (error) throw new Error(error.message)
  }

  // Send email for accepted status change
  if (newStatus === "accepted") {
    const [{ data: repreneurData }, { data: offerInfo }] = await Promise.all([
      supabase.from("repreneurs").select("first_name, last_name, email").eq("id", repreneurId).single(),
      supabase.from("repreneur_offers").select("offer:offers(name)").eq("id", repreneurOfferId).single(),
    ])

    if (repreneurData && offerInfo?.offer) {
      const offerRow = Array.isArray(offerInfo.offer) ? offerInfo.offer[0] : offerInfo.offer
      const offerName = (offerRow as { name: string }).name
      const emailData = {
        id: repreneurId,
        firstName: repreneurData.first_name,
        lastName: repreneurData.last_name,
        email: repreneurData.email,
      }

      const deliveryKeyTimestamp = acceptanceTimestamp ?? "accepted"
      try {
        await sendEmail({
          to: repreneurData.email,
          subject: `Félicitations! Vous avez accepté l'offre ${offerName}`,
          repreneurId,
          templateKey: "offer_accepted",
          idempotencyKey: `offer-accepted:${repreneurOfferId}:${deliveryKeyTimestamp}`,
          react: OfferAcceptedEmail({
            repreneur: emailData,
            metadata: { offerName },
          }),
        })
      } catch (err) {
        // The decision has already committed. A retry will use the same key,
        // so preserve the staff action while making an uncertain delivery safe.
        console.error("Failed to send offer accepted email:", err)
      }
    }
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
}

export async function deleteRepreneurOffer(repreneurOfferId: string, repreneurId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  await requireOwnedRepreneurOffer(supabase, repreneurOfferId, repreneurId)

  const { error } = await supabase
    .from("repreneur_offers")
    .delete()
    .eq("id", repreneurOfferId)
    .eq("repreneur_id", repreneurId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
}

// === Milestone Actions ===

export async function createMilestone(
  repreneurOfferId: string,
  repreneurId: string,
  milestoneType: MilestoneType,
  title: string,
  notes?: string,
  dueDate?: string,
) {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()
  await requireOwnedRepreneurOffer(supabase, repreneurOfferId, repreneurId)

  const { error } = await supabase.from("offer_milestones").insert({
    repreneur_offer_id: repreneurOfferId,
    milestone_type: milestoneType,
    title,
    notes: notes || null,
    due_date: dueDate || null,
    created_by: user.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function toggleMilestoneComplete(milestoneId: string, repreneurId: string, isCompleted: boolean) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const ownedMilestone = await requireOwnedMilestone(supabase, milestoneId, repreneurId)

  const updates: Record<string, unknown> = {
    is_completed: isCompleted,
  }

  if (isCompleted) {
    updates.completed_at = new Date().toISOString()
  } else {
    updates.completed_at = null
  }

  const mutation = supabase.from("offer_milestones").update(updates).eq("id", milestoneId)

  // Completing is a state transition, not a blind write. Retries reuse the
  // stored completion timestamp as their stable provider-delivery identity.
  const { data: transitionedMilestone, error } = isCompleted
    ? await mutation.eq("is_completed", false).select("id, completed_at").maybeSingle()
    : await mutation

  if (error) {
    throw new Error(error.message)
  }

  // A request retry after an uncertain response reuses the exact completion
  // timestamp as its provider key. Resend accepts only one recipient message.
  const completion =
    transitionedMilestone ??
    (ownedMilestone.is_completed && ownedMilestone.completed_at
      ? { id: milestoneId, completed_at: ownedMilestone.completed_at }
      : null)
  let notification: Awaited<ReturnType<typeof sendMilestoneCompletionNotification>> | null = null
  if (isCompleted && completion?.completed_at) {
    notification = await sendMilestoneCompletionNotification(
      supabase,
      milestoneId,
      repreneurId,
      completion.completed_at,
    )
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  return {
    success: true as const,
    notificationSent: notification?.success ?? null,
    ...(!notification?.success && notification ? { notificationError: notification.error } : {}),
  }
}

async function sendMilestoneCompletionNotification(
  supabase: ReturnType<typeof createAdminClient>,
  milestoneId: string,
  repreneurId: string,
  completedAt: string,
) {
  const idempotencyKey = notificationIdempotencyKey.milestoneCompleted(milestoneId, completedAt)
  try {
    const delivery = await deliverNotification({
      idempotencyKey,
      send: async (claimedKey) => {
        const { data: currentMilestone } = await supabase
          .from("offer_milestones")
          .select("is_completed, completed_at")
          .eq("id", milestoneId)
          .maybeSingle()
        if (!currentMilestone?.is_completed || currentMilestone.completed_at !== completedAt) {
          return {
            success: false as const,
            error: "This milestone completion notification is no longer applicable.",
          }
        }

        const { data: milestoneData } = await supabase
          .from("offer_milestones")
          .select("title, repreneur_offer:repreneur_offers(offer:offers(name))")
          .eq("id", milestoneId)
          .single()

        const { data: repreneurData } = await supabase
          .from("repreneurs")
          .select("first_name, last_name, email")
          .eq("id", repreneurId)
          .single()

        if (!repreneurData || !milestoneData) {
          return {
            success: false as const,
            error: "Recipient or milestone details are unavailable.",
          }
        }

        const repreneurOfferRow = Array.isArray(milestoneData.repreneur_offer)
          ? milestoneData.repreneur_offer[0]
          : milestoneData.repreneur_offer
        const offerRow = Array.isArray(repreneurOfferRow?.offer) ? repreneurOfferRow.offer[0] : repreneurOfferRow?.offer
        const offerName = (offerRow as { name: string } | undefined)?.name || "votre accompagnement"

        return sendEmail({
          to: repreneurData.email,
          subject: `Bravo! Jalon complété: ${milestoneData.title}`,
          repreneurId,
          templateKey: "milestone_completed",
          idempotencyKey: claimedKey,
          react: MilestoneCompletedEmail({
            repreneur: {
              id: repreneurId,
              firstName: repreneurData.first_name,
              lastName: repreneurData.last_name,
              email: repreneurData.email,
            },
            metadata: {
              milestoneTitle: milestoneData.title,
              offerName,
            },
          }),
        })
      },
    })
    return notificationResult(delivery)
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "The notification delivery could not be claimed.",
    }
  }
}

export async function retryMilestoneCompletionNotification(milestoneId: string, repreneurId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const milestone = await requireOwnedMilestone(supabase, milestoneId, repreneurId)
  if (!milestone.is_completed || !milestone.completed_at) {
    return {
      success: false as const,
      error: "This milestone is not currently completed.",
    }
  }
  return sendMilestoneCompletionNotification(supabase, milestoneId, repreneurId, milestone.completed_at)
}

export async function updateMilestone(
  milestoneId: string,
  repreneurId: string,
  title: string,
  notes?: string,
  dueDate?: string,
) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  await requireOwnedMilestone(supabase, milestoneId, repreneurId)

  const { error } = await supabase
    .from("offer_milestones")
    .update({
      title,
      notes: notes || null,
      due_date: dueDate || null,
    })
    .eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function deleteMilestone(milestoneId: string, repreneurId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  await requireOwnedMilestone(supabase, milestoneId, repreneurId)

  const { error } = await supabase.from("offer_milestones").delete().eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

// === Data Fetching ===

export async function getAllClientOffers() {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("repreneur_offers")
    .select(
      `
      *,
      offer:offers(*),
      repreneur:repreneurs(id, first_name, last_name, email, avatar_url),
      milestones:offer_milestones(*)
    `,
    )
    .order("offered_at", { ascending: false })

  if (error) {
    console.error("Error fetching client offers:", error)
    return []
  }

  return data || []
}
