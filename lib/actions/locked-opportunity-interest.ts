"use server"

import { revalidatePath } from "next/cache"
import { requirePortalAccess } from "@/lib/access-control"
import { createLockedOpportunityInterestStore } from "@/lib/data/locked-opportunity-interest"
import { sendLockedOpportunityInterestEmail } from "@/lib/email/locked-opportunity-interest"
import {
  LockedOpportunityInterestUnavailableError,
  expressOpportunityInterest,
} from "@/lib/locked-opportunity-interest"

type LockedOpportunityInterestActionState =
  | { status: "idle"; message: ""; recorded: false }
  | { status: "success"; message: string; recorded: true }
  | { status: "error"; message: string; recorded: boolean }

function readOpportunityId(formData: FormData) {
  const value = formData.get("opportunity_id")
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function expressOpportunityInterestAction(
  _previousState: LockedOpportunityInterestActionState,
  formData: FormData,
): Promise<LockedOpportunityInterestActionState> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) {
    return {
      status: "error",
      message: "No repreneur profile is linked to this login.",
      recorded: false,
    }
  }

  const opportunityId = readOpportunityId(formData)
  if (!opportunityId) {
    return {
      status: "error",
      message: "This opportunity could not be identified.",
      recorded: false,
    }
  }

  const now = new Date().toISOString()

  try {
    const outcome = await expressOpportunityInterest(
      {
        opportunityId,
        repreneurId: access.repreneurId,
        actorId: access.user.id,
        now,
      },
      {
        store: createLockedOpportunityInterestStore(),
        notifier: { send: sendLockedOpportunityInterestEmail },
      },
    )

    revalidatePath("/portal/deals")
    revalidatePath("/opportunities/reviews")
    revalidatePath(`/opportunities/${opportunityId}`)

    if (outcome.status === "notification_failed") {
      return {
        status: "error",
        message: "Your interest is recorded, but the email alert did not go through yet. Retry to notify Re-New.",
        recorded: true,
      }
    }

    return {
      status: "success",
      message: "Thank you. Re-New has received your interest and will follow up with you directly.",
      recorded: true,
    }
  } catch (error) {
    if (error instanceof LockedOpportunityInterestUnavailableError) {
      return {
        status: "error",
        message: "This opportunity is no longer available to express interest. Refresh the page to see its current status.",
        recorded: false,
      }
    }

    console.error("Failed to express interest in opportunity", error)
    return {
      status: "error",
      message: "We could not record your interest right now. Please try again.",
      recorded: false,
    }
  }
}
