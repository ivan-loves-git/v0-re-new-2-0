import type {
  OpportunityMatchStatus,
  OpportunityPursuitStage,
  OpportunityStatus,
} from "@/lib/types/opportunity"

export type OpportunityJourney =
  | "draft"
  | "live_in_inventory"
  | "matching"
  | "proposed"
  | "interest_received"
  | "active_pursuit"
  | "intermediary_meeting"
  | "seller_meeting"
  | "loi"
  | "closed"
  | "dropped"
  | "paused"
  | "archived"

export type OpportunityJourneyMatchInput = {
  status: OpportunityMatchStatus
  pursuit_stage?: OpportunityPursuitStage | null
}

export type OpportunityJourneyInput = {
  status: OpportunityStatus
  matches?: OpportunityJourneyMatchInput[] | null
}

export const OPPORTUNITY_JOURNEY_OPTIONS: ReadonlyArray<{ value: OpportunityJourney; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "live_in_inventory", label: "Live in inventory" },
  { value: "matching", label: "Matching" },
  { value: "proposed", label: "Proposed" },
  { value: "interest_received", label: "Interest received" },
  { value: "active_pursuit", label: "Active pursuit" },
  { value: "intermediary_meeting", label: "Intermediary meeting" },
  { value: "seller_meeting", label: "Seller meeting" },
  { value: "loi", label: "LOI" },
  { value: "closed", label: "Closed" },
  { value: "dropped", label: "Dropped" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
] as const

const pursuitStageToJourney: Record<OpportunityPursuitStage, OpportunityJourney> = {
  interest: "active_pursuit",
  intermediary_meeting: "intermediary_meeting",
  seller_meeting: "seller_meeting",
  loi: "loi",
  closed: "closed",
  dropped: "dropped",
}

export function getOpportunityJourneyLabel(journey: OpportunityJourney): string {
  return OPPORTUNITY_JOURNEY_OPTIONS.find((option) => option.value === journey)?.label ?? journey
}

export function deriveOpportunityJourney(input: OpportunityJourneyInput): OpportunityJourney {
  if (input.status === "draft") return "draft"
  if (input.status === "paused") return "paused"
  if (input.status === "archived") return "archived"
  if (input.status === "closed") return "closed"

  const matches = input.matches ?? []
  if (matches.length === 0) return "live_in_inventory"

  const activePursuit = matches.find((match) => match.status === "active_pursuit")
  if (activePursuit) {
    return activePursuit.pursuit_stage ? pursuitStageToJourney[activePursuit.pursuit_stage] : "active_pursuit"
  }

  if (matches.some((match) => match.status === "interested")) return "interest_received"
  if (matches.some((match) => match.status === "proposed")) return "proposed"
  if (matches.some((match) => match.status === "shortlisted" || match.status === "draft")) return "matching"
  if (matches.every((match) => match.status === "dropped" || match.status === "declined")) return "dropped"

  return "live_in_inventory"
}
