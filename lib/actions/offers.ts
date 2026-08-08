"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { redirect } from "next/navigation"
import type {
  Offer_Insert,
  OfferStatus,
  MilestoneType,
} from "@/lib/types/offer"
import type { DeclineReasonCategory } from "@/lib/types/repreneur"
import { isDeclineReasonCategory } from "@/lib/types/repreneur"
import { sendEmail } from "@/lib/email"
import { OfferReceivedEmail } from "@/lib/email/templates/offer-received"
import { OfferAcceptedEmail } from "@/lib/email/templates/offer-accepted"
import { MilestoneCompletedEmail } from "@/lib/email/templates/milestone-completed"

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

  const { error } = await supabase
    .from("offers")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
}

export async function assignOfferToRepreneur(
  repreneurId: string,
  offerId: string,
) {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()

  // Insert the offer assignment
  const { error: offerError } = await supabase.from("repreneur_offers").insert({
    repreneur_id: repreneurId,
    offer_id: offerId,
    status: "offered",
    offered_at: new Date().toISOString(),
    created_by: user.id,
  })

  if (offerError) {
    console.error("Database error in assignOfferToRepreneur:", offerError)
    throw new Error(`Database error: ${offerError.message}`)
  }

  // Assigning an offer moves the repreneur to "qualified" (offer sent, pending response).
  // "client" only once the offer is accepted (handled by offer_approved activity).
  const { error: statusError } = await supabase
    .from("repreneurs")
    .update({ lifecycle_status: "qualified" })
    .eq("id", repreneurId)

  if (statusError) {
    throw new Error(statusError.message)
  }

  // Send offer received email (parallel fetch)
  const [{ data: repreneurData }, { data: offerData }] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("first_name, last_name, email")
      .eq("id", repreneurId)
      .single(),
    supabase.from("offers").select("name").eq("id", offerId).single(),
  ])

  if (repreneurData && offerData) {
    sendEmail({
      to: repreneurData.email,
      subject: `Nouvelle offre Re-New: ${offerData.name}`,
      repreneurId,
      templateKey: "offer_received",
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
    }).catch((err) => {
      console.error("Failed to send offer received email:", err)
    })
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
  revalidatePath("/repreneurs")
  revalidatePath("/pipeline")
  revalidateRepreneurDashboardTags()
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

  const updates: Record<string, unknown> = { status: newStatus }

  if (newStatus === "accepted") {
    const { data: repreneurOffer } = await supabase
      .from("repreneur_offers")
      .select("*, offer:offers(*)")
      .eq("id", repreneurOfferId)
      .single()

    if (repreneurOffer?.offer) {
      const now = new Date()
      updates.accepted_at = now.toISOString()

      const expiresAt = new Date(now)
      expiresAt.setDate(
        expiresAt.getDate() + repreneurOffer.offer.duration_days,
      )
      updates.expires_at = expiresAt.toISOString()
    }
  } else if (newStatus === "declined") {
    updates.declined_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("repreneur_offers")
    .update(updates)
    .eq("id", repreneurOfferId)

  if (error) {
    throw new Error(error.message)
  }

  // Keep repreneur.lifecycle_status in sync with the offer status.
  if (newStatus === "accepted") {
    await supabase
      .from("repreneurs")
      .update({ lifecycle_status: "client" })
      .eq("id", repreneurId)
  } else if (newStatus === "declined") {
    await supabase
      .from("repreneurs")
      .update({
        lifecycle_status: "declined",
        declined_at: new Date().toISOString(),
        decline_reason_category: declineReasonCategory || null,
        decline_reason_text: normalizedDeclineReasonText,
      })
      .eq("id", repreneurId)
  }

  // Send email for accepted status change
  if (newStatus === "accepted") {
    const [{ data: repreneurData }, { data: offerInfo }] = await Promise.all([
      supabase
        .from("repreneurs")
        .select("first_name, last_name, email")
        .eq("id", repreneurId)
        .single(),
      supabase
        .from("repreneur_offers")
        .select("offer:offers(name)")
        .eq("id", repreneurOfferId)
        .single(),
    ])

    if (repreneurData && offerInfo?.offer) {
      const offerRow = Array.isArray(offerInfo.offer)
        ? offerInfo.offer[0]
        : offerInfo.offer
      const offerName = (offerRow as { name: string }).name
      const emailData = {
        id: repreneurId,
        firstName: repreneurData.first_name,
        lastName: repreneurData.last_name,
        email: repreneurData.email,
      }

      sendEmail({
        to: repreneurData.email,
        subject: `Félicitations! Vous avez accepté l'offre ${offerName}`,
        repreneurId,
        templateKey: "offer_accepted",
        react: OfferAcceptedEmail({
          repreneur: emailData,
          metadata: { offerName },
        }),
      }).catch((err) => {
        console.error("Failed to send offer accepted email:", err)
      })
    }
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
  revalidateRepreneurDashboardTags()
}

export async function deleteRepreneurOffer(
  repreneurOfferId: string,
  repreneurId: string,
) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("repreneur_offers")
    .delete()
    .eq("id", repreneurOfferId)

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

export async function toggleMilestoneComplete(
  milestoneId: string,
  repreneurId: string,
  isCompleted: boolean,
) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = {
    is_completed: isCompleted,
  }

  if (isCompleted) {
    updates.completed_at = new Date().toISOString()
  } else {
    updates.completed_at = null
  }

  const { error } = await supabase
    .from("offer_milestones")
    .update(updates)
    .eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  // Send milestone completed email only when marking as complete
  if (isCompleted) {
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

    if (repreneurData && milestoneData) {
      const repreneurOfferRow = Array.isArray(milestoneData.repreneur_offer)
        ? milestoneData.repreneur_offer[0]
        : milestoneData.repreneur_offer
      const offerRow = Array.isArray(repreneurOfferRow?.offer)
        ? repreneurOfferRow.offer[0]
        : repreneurOfferRow?.offer
      const offerName =
        (offerRow as { name: string } | undefined)?.name ||
        "votre accompagnement"

      sendEmail({
        to: repreneurData.email,
        subject: `Bravo! Jalon complété: ${milestoneData.title}`,
        repreneurId,
        templateKey: "milestone_completed",
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
      }).catch((err) => {
        console.error("Failed to send milestone completed email:", err)
      })
    }
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
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

export async function deleteMilestone(
  milestoneId: string,
  repreneurId: string,
) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("offer_milestones")
    .delete()
    .eq("id", milestoneId)

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
