import type { ExternalPursuitStage } from "@/lib/types/external-pursuit"
import type { OpportunityMatchStatus, OpportunityPursuitStage, OpportunityStatus } from "@/lib/types/opportunity"
import { deriveOpportunityJourney, type OpportunityJourney } from "@/lib/utils/opportunity-journey"

export function mapCanonicalJourneyToBoardStage(journey: OpportunityJourney): ExternalPursuitStage | null {
  switch (journey) {
    case "draft":
    case "matching":
    case "proposed": return "identified"
    case "interest_received":
    case "active_pursuit": return "contact_qualification"
    case "info_memo_received": return "information"
    case "intermediary_meeting":
    case "seller_meeting": return "meetings"
    case "loi": return "loi"
    case "closed": return "completed"
    case "dropped": return "dropped_archived"
    default: return null
  }
}

export function projectCanonicalJourneyToBoard(input: {
  opportunityStatus: OpportunityStatus
  matchStatus: OpportunityMatchStatus
  pursuitStage: OpportunityPursuitStage | null
}) {
  const match = { status: input.matchStatus, pursuit_stage: input.pursuitStage }

  // A board card represents one canonical match, not the opportunity aggregate.
  // On a closed opportunity, only the match that actually reached a terminal
  // pursuit state belongs on this board. Proposed or declined siblings must not
  // inherit the opportunity-level `closed` journey.
  if (input.opportunityStatus === "closed") {
    const terminalMatch = input.matchStatus === "completed"
      || input.matchStatus === "dropped"
      || (input.matchStatus === "active_pursuit" && (input.pursuitStage === "closed" || input.pursuitStage === "dropped"))
    if (!terminalMatch) {
      const journey = deriveOpportunityJourney({ status: "active", matches: [match] })
      return { journey, stage: null }
    }
  }

  if (input.opportunityStatus === "paused" || input.opportunityStatus === "archived") {
    const journey = deriveOpportunityJourney({ status: input.opportunityStatus, matches: [match] })
    return { journey, stage: null }
  }

  if (input.matchStatus === "declined") {
    return { journey: "dropped" as const, stage: null }
  }

  const journey = input.matchStatus === "completed"
    ? "closed"
    : deriveOpportunityJourney({ status: "active", matches: [match] })
  return { journey, stage: mapCanonicalJourneyToBoardStage(journey) }
}
