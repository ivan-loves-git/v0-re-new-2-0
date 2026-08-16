import type { ExternalPursuitStage } from "@/lib/types/external-pursuit"

export type ExternalPursuitFreshness = "fresh" | "stale" | "unknown"
export type ExternalPursuitDueState = "overdue" | "today" | "upcoming" | "none"

export interface ExternalPursuitCapacityCounts {
  total: number
  stage: Record<ExternalPursuitStage, number>
  availability: Record<"available" | "limited" | "unavailable" | "unknown", number>
  freshness: Record<ExternalPursuitFreshness, number>
  due: Record<ExternalPursuitDueState, number>
}

export interface ExternalPursuitCapacityDossier {
  id: string
  owner_repreneur_id: string
  title: string
  stage: string
  availability: "available" | "limited" | "unavailable" | "unknown"
  due_at: string | null
  due_state: ExternalPursuitDueState
  last_confirmed_at: string | null
  freshness: ExternalPursuitFreshness
}

export interface ExternalPursuitLinkedDossier {
  id: string
  title: string
  stage: string
  opportunity_id: string
  opportunity_reference: string
  converted_at: string
}

export interface ExternalPursuitCapacitySnapshot {
  as_of_paris_date: string
  /** ISO-8601 local timestamp with the Europe/Paris UTC offset at this instant. */
  as_of_paris_timestamp: string
  open_capacity: ExternalPursuitCapacityCounts
  open_dossiers: ExternalPursuitCapacityDossier[]
  linked_dossiers: ExternalPursuitLinkedDossier[]
}

export type ExternalPursuitConfirmationResult =
  | { success: true; outcome: "confirmed"; message: string }
  | { success: false; outcome: "rejected" | "ambiguous"; message: string }
