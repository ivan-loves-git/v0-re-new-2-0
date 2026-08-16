export type ExternalPursuitFreshness = "fresh" | "stale" | "never_confirmed"
export type ExternalPursuitDueState = "overdue" | "today" | "upcoming" | "none"

export interface ExternalPursuitCapacityCounts {
  total: number
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
  open_capacity: ExternalPursuitCapacityCounts
  open_dossiers: ExternalPursuitCapacityDossier[]
  linked_dossiers: ExternalPursuitLinkedDossier[]
}
