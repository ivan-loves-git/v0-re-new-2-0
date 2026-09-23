import type { ReNewPursuitBoardRecord } from "@/lib/actions/external-pursuit-board"
import type { OpportunityMatchStatus, OpportunityPursuitStage } from "@/lib/types/opportunity"
import { projectCanonicalJourneyToBoard } from "@/lib/utils/external-pursuit-board"
import { createPortalPreviewHref } from "@/lib/portal-preview-routes"

export interface SelectedReNewPursuitDeal {
  match_id: string | null
  match_status: OpportunityMatchStatus | null
  pursuit_stage?: OpportunityPursuitStage | null
  pursuit_stage_provenance?: "staff_confirmed_history" | null
  public_title?: string | null
  updated_at: string
}

/** Mirror the owner portal's canonical cards, never the all-owner staff board. */
export function projectSelectedReNewPursuits(
  repreneurId: string,
  deals: SelectedReNewPursuitDeal[],
): ReNewPursuitBoardRecord[] {
  return deals.flatMap((deal) => {
    if (!deal.match_id || !deal.match_status) return []
    const { stage, journey } = projectCanonicalJourneyToBoard({
      opportunityStatus: "active",
      matchStatus: deal.match_status,
      pursuitStage: deal.pursuit_stage ?? null,
    })
    if (!stage) return []
    return [{
      id: deal.match_id,
      title: deal.public_title || "Confidential acquisition opportunity",
      stage,
      canonicalStage: deal.pursuit_stage ?? null,
      canonicalJourney: journey,
      stageProvenance: deal.pursuit_stage_provenance ?? null,
      href: createPortalPreviewHref(repreneurId, deal.match_id),
      ownerName: null,
      updatedAt: deal.updated_at,
    }]
  })
}
