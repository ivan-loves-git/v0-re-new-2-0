import { createAdminClient } from "@/lib/supabase/admin"
import {
  LockedOpportunityInterestUnavailableError,
  type LockedOpportunityInterestNotificationDetails,
  type LockedOpportunityInterestRecord,
  type LockedOpportunityInterestStore,
} from "@/lib/locked-opportunity-interest"

interface LockedInterestRpcRow {
  match_id: string
  expressed_at: string
  notification_sent_at: string | null
}

function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string,
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || email
}

function opportunityTitle(
  publicTitle: string | null | undefined,
  sector: string | null | undefined,
  reference: string,
) {
  return publicTitle || sector || reference
}

function isUnavailableRpcError(error: { code?: string; message?: string }) {
  return error.code === "P0001" && error.message?.includes("interest_not_available")
}

export function createLockedOpportunityInterestStore(): LockedOpportunityInterestStore {
  const supabase = createAdminClient()

  return {
    async recordInterest(input): Promise<LockedOpportunityInterestRecord> {
      const { data, error } = await supabase.rpc(
        "express_opportunity_interest",
        {
          p_opportunity_id: input.opportunityId,
          p_repreneur_id: input.repreneurId,
          p_actor_id: input.actorId,
          p_expressed_at: input.expressedAt,
        },
      )

      if (error) {
        if (isUnavailableRpcError(error)) {
          throw new LockedOpportunityInterestUnavailableError()
        }
        throw new Error(error.message)
      }

      const row = (Array.isArray(data) ? data[0] : data) as LockedInterestRpcRow | null
      if (!row) throw new LockedOpportunityInterestUnavailableError()

      return {
        matchId: row.match_id,
        expressedAt: row.expressed_at,
        notificationSentAt: row.notification_sent_at,
      }
    },

    async getNotificationDetails(input): Promise<LockedOpportunityInterestNotificationDetails> {
      const [repreneurResult, opportunityResult, activePursuitResult] = await Promise.all([
        supabase
          .from("repreneurs")
          .select("id, first_name, last_name, email")
          .eq("id", input.repreneurId)
          .maybeSingle(),
        supabase
          .from("opportunities")
          .select("id, reference, public_title, sector")
          .eq("id", input.opportunityId)
          .maybeSingle(),
        supabase
          .from("opportunity_matches")
          .select("id")
          .eq("opportunity_id", input.opportunityId)
          .eq("status", "active_pursuit")
          .neq("repreneur_id", input.repreneurId)
          .limit(1),
      ])

      if (repreneurResult.error) throw new Error(repreneurResult.error.message)
      if (opportunityResult.error) throw new Error(opportunityResult.error.message)
      if (activePursuitResult.error) throw new Error(activePursuitResult.error.message)
      if (!repreneurResult.data || !opportunityResult.data) {
        throw new Error("Interest notification context was not found")
      }

      const repreneur = repreneurResult.data
      const opportunity = opportunityResult.data

      return {
        repreneurId: repreneur.id,
        repreneurName: displayName(
          repreneur.first_name,
          repreneur.last_name,
          repreneur.email,
        ),
        repreneurEmail: repreneur.email,
        opportunityId: opportunity.id,
        opportunityReference: opportunity.reference,
        opportunityTitle: opportunityTitle(
          opportunity.public_title,
          opportunity.sector,
          opportunity.reference,
        ),
        hasOtherActivePursuit: (activePursuitResult.data?.length ?? 0) > 0,
      }
    },

    async markNotificationSent(input): Promise<void> {
      const { data, error } = await supabase
        .from("opportunity_matches")
        .update({ interest_notification_sent_at: input.sentAt })
        .eq("id", input.matchId)
        .eq("repreneur_id", input.repreneurId)
        .eq("opportunity_id", input.opportunityId)
        .eq("status", "interested")
        .is("interest_notification_sent_at", null)
        .select("id")
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) {
        const { data: existing, error: existingError } = await supabase
          .from("opportunity_matches")
          .select("id, interest_notification_sent_at")
          .eq("id", input.matchId)
          .eq("repreneur_id", input.repreneurId)
          .eq("opportunity_id", input.opportunityId)
          .eq("status", "interested")
          .maybeSingle()

        if (existingError) throw new Error(existingError.message)
        if (!existing?.interest_notification_sent_at) {
          throw new Error("Interest notification status could not be recorded")
        }
      }
    },
  }
}
