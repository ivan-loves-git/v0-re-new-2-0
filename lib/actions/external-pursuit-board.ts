import "server-only"

import { requireStaffAccess } from "@/lib/access-control"
import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ExternalPursuitStage } from "@/lib/types/external-pursuit"
import type { OpportunityMatchStatus, OpportunityPursuitStage, OpportunityStatus } from "@/lib/types/opportunity"
import { projectCanonicalJourneyToBoard } from "@/lib/utils/external-pursuit-board"

export interface ReNewPursuitBoardRecord {
  id: string
  title: string
  stage: ExternalPursuitStage
  canonicalStage: OpportunityPursuitStage | null
  canonicalJourney: string
  href: string
  ownerName: string | null
  updatedAt: string
}

function recordFromCanonical(input: {
  id: string; title: string; href: string; ownerName: string | null; updatedAt: string
  opportunityStatus: OpportunityStatus; matchStatus: OpportunityMatchStatus; pursuitStage: OpportunityPursuitStage | null
}): ReNewPursuitBoardRecord | null {
  const { journey, stage } = projectCanonicalJourneyToBoard(input)
  if (!stage) return null
  return { id: input.id, title: input.title, stage, canonicalStage: input.pursuitStage, canonicalJourney: journey, href: input.href, ownerName: input.ownerName, updatedAt: input.updatedAt }
}

export async function listPortalReNewPursuitBoard(): Promise<ReNewPursuitBoardRecord[]> {
  const { opportunities } = await listMyRepreneurOpportunities()
  return opportunities.flatMap((opportunity) => {
    const record = recordFromCanonical({
      id: opportunity.match_id, title: opportunity.public_title || opportunity.reference,
      href: `/portal/deals/${opportunity.match_id}`, ownerName: null, updatedAt: opportunity.updated_at,
      // The established portal reader exposes only active opportunities.
      opportunityStatus: "active", matchStatus: opportunity.match_status, pursuitStage: opportunity.pursuit_stage ?? null,
    })
    return record ? [record] : []
  })
}

export async function listStaffReNewPursuitBoard(): Promise<ReNewPursuitBoardRecord[]> {
  const opportunities = await listOpportunityWorkSurfaceRecords({ includeSourceReview: false })
  return opportunities.flatMap((opportunity) => opportunity.matches.flatMap((match) => {
    const ownerName = match.repreneur ? [match.repreneur.first_name, match.repreneur.last_name].filter(Boolean).join(" ") || null : null
    const record = recordFromCanonical({
      id: match.id, title: opportunity.public_title || opportunity.reference,
      href: `/opportunities/${opportunity.id}`, ownerName, updatedAt: match.updated_at,
      opportunityStatus: opportunity.status, matchStatus: match.status, pursuitStage: match.pursuit_stage ?? null,
    })
    return record ? [record] : []
  }))
}

export async function listExternalPursuitOwners() {
  await requireStaffAccess()
  const { data, error } = await createAdminClient()
    .from("repreneurs")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ id: row.id as string, name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed repreneur" }))
}
