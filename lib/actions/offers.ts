"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Offer_Insert, OfferStatus, MilestoneType } from "@/lib/types/offer"
import { sendEmail } from "@/lib/email"
import { OfferReceivedEmail } from "@/lib/email/templates/offer-received"
import { OfferAcceptedEmail } from "@/lib/email/templates/offer-accepted"
import { MilestoneCompletedEmail } from "@/lib/email/templates/milestone-completed"

export async function createOffer(formData: FormData) {
  const supabase = createAdminClient()

  const offer: Offer_Insert = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    price: parseFloat(formData.get("price") as string),
    duration_days: parseInt(formData.get("duration_days") as string),
    acceptance_deadline_days: formData.get("acceptance_deadline_days")
      ? parseInt(formData.get("acceptance_deadline_days") as string)
      : 14, // Default 14 days to accept
    includes_hours: formData.get("includes_hours")
      ? parseInt(formData.get("includes_hours") as string)
      : 0,
    includes_resources: formData.get("includes_resources") === "true",
    is_active: formData.get("is_active") !== "false",
  }

  const { error } = await supabase.from("offers").insert(offer)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
  redirect("/offers")
}

export async function updateOffer(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const updates = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price: parseFloat(formData.get("price") as string),
    duration_days: parseInt(formData.get("duration_days") as string),
    acceptance_deadline_days: formData.get("acceptance_deadline_days")
      ? parseInt(formData.get("acceptance_deadline_days") as string)
      : null,
    includes_hours: formData.get("includes_hours")
      ? parseInt(formData.get("includes_hours") as string)
      : null,
    includes_resources: formData.get("includes_resources") === "true",
    is_active: formData.get("is_active") === "true",
  }

  const { error } = await supabase.from("offers").update(updates).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
}

export async function toggleOfferActive(id: string, isActive: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("offers").update({ is_active: isActive }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
}

export async function assignOfferToRepreneur(repreneurId: string, offerId: string) {
  const supabase = createAdminClient()

  // Get current user from Better Auth
  let user
  try {
    user = await requireUser()
  } catch (authError) {
    console.error("Auth error in assignOfferToRepreneur:", authError)
    throw new Error(`Authentication failed: ${authError instanceof Error ? authError.message : "Unknown auth error"}`)
  }

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
    supabase.from("repreneurs").select("first_name, last_name, email").eq("id", repreneurId).single(),
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
}

export async function updateRepreneurOfferStatus(repreneurOfferId: string, newStatus: OfferStatus, repreneurId: string) {
  const supabase = createAdminClient()

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
      expiresAt.setDate(expiresAt.getDate() + repreneurOffer.offer.duration_days)
      updates.expires_at = expiresAt.toISOString()
    }
  }

  const { error } = await supabase.from("repreneur_offers").update(updates).eq("id", repreneurOfferId)

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
      .update({ lifecycle_status: "declined", declined_at: new Date().toISOString() })
      .eq("id", repreneurId)
  }

  // Send email for accepted status change
  if (newStatus === "accepted") {
    const [{ data: repreneurData }, { data: offerInfo }] = await Promise.all([
      supabase.from("repreneurs").select("first_name, last_name, email").eq("id", repreneurId).single(),
      supabase.from("repreneur_offers").select("offer:offers(name)").eq("id", repreneurOfferId).single(),
    ])

    if (repreneurData && offerInfo?.offer) {
      const offerName = (offerInfo.offer as { name: string }).name
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
}

export async function deleteRepreneurOffer(repreneurOfferId: string, repreneurId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("repreneur_offers").delete().eq("id", repreneurOfferId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
}

// === Milestone Actions ===

export async function createMilestone(
  repreneurOfferId: string,
  repreneurId: string,
  milestoneType: MilestoneType,
  title: string,
  notes?: string,
  dueDate?: string
) {
  const supabase = createAdminClient()

  // Get current user from Better Auth
  const user = await requireUser()

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
  isCompleted: boolean
) {
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
      const offerName = (milestoneData.repreneur_offer as { offer: { name: string } })?.offer?.name || "votre accompagnement"

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
            milestoneName: milestoneData.title,
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
  dueDate?: string
) {
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

export async function deleteMilestone(milestoneId: string, repreneurId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("offer_milestones").delete().eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

// === Data Fetching ===

export async function getAllClientOffers() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("repreneur_offers")
    .select(`
      *,
      offer:offers(*),
      repreneur:repreneurs(id, first_name, last_name, email, avatar_url),
      milestones:offer_milestones(*)
    `)
    .order("offered_at", { ascending: false })

  if (error) {
    console.error("Error fetching client offers:", error)
    return []
  }

  return data || []
}
