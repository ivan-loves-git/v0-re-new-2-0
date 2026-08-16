export const EXTERNAL_PURSUIT_STAGES = [
  "identified",
  "contact_qualification",
  "information",
  "meetings",
  "negotiation",
  "loi",
  "due_diligence_financing",
  "completed",
  "dropped_archived",
] as const

export type ExternalPursuitStage = (typeof EXTERNAL_PURSUIT_STAGES)[number]

export const EXTERNAL_PURSUIT_AVAILABILITY = [
  "available",
  "limited",
  "unavailable",
  "unknown",
] as const

export type ExternalPursuitAvailability =
  (typeof EXTERNAL_PURSUIT_AVAILABILITY)[number]

/** W-107: paired with a concrete next action; never a task-manager assignment. */
export type ExternalPursuitResponsibleParty = "owner" | "staff"

export type ExternalPursuitDeletionStatus =
  | "active"
  | "delete_requested"
  | "deleted"

export interface ExternalPursuitContactInput {
  id?: string
  name?: string | null
  organisation?: string | null
  roleTitle?: string | null
  email?: string | null
  phone?: string | null
}

export interface ExternalPursuitInput {
  /** Staff may select an owner. Repreneur callers are always bound to session ownership. */
  ownerRepreneurId?: string
  title: string
  /** Optional, external-only context. It never creates a Re-New source record. */
  externalUrl?: string | null
  targetCompany?: string | null
  sourceChannel?: string | null
  revenueMeur?: number | null
  ebitdaKeur?: number | null
  headcount?: number | null
  stage?: ExternalPursuitStage
  availability?: ExternalPursuitAvailability
  dueAt?: string | null
  sharedNotes?: string | null
  /** Accepted only from staff actions; never projected to an owner. */
  staffInternalNotes?: string | null
}

/** W-106 must retain a generated idempotency key across a network retry. */
export type ExternalPursuitUpdateInput = Omit<ExternalPursuitInput, "ownerRepreneurId"> & {
  stage?: ExternalPursuitStage
  availability?: ExternalPursuitAvailability
  dueAt?: string | null
}

/**
 * Narrow W-107 patch. It intentionally cannot rename a dossier or move its
 * stage, so a follow-up save cannot overwrite concurrent board work.
 */
export interface ExternalPursuitFollowUpInput {
  nextAction?: string | null
  responsibleParty?: ExternalPursuitResponsibleParty | null
  availability?: ExternalPursuitAvailability
  dueAt?: string | null
  sharedNotes?: string | null
  /** Staff-only; it is never passed by the owner form or returned to it. */
  staffInternalNotes?: string | null
}

/** Read model accepted by the self-contained W-107 panel mount. */
export interface ExternalPursuitFollowUpSnapshot {
  nextAction?: string | null
  responsibleParty?: ExternalPursuitResponsibleParty | null
  availability: ExternalPursuitAvailability
  dueAt?: string | null
  sharedNotes?: string | null
  /** Supplied only from the staff projection. */
  staffInternalNotes?: string | null
}

export interface ExternalPursuitActionResult {
  success: boolean
  message: string
  pursuitId?: string
  /** Keep the exact client snapshot and idempotency key until replay succeeds. */
  retryExact?: boolean
}

export interface ExternalPursuitBoardRecord {
  id: string
  ownerRepreneurId: string
  ownerName: string | null
  title: string
  stage: ExternalPursuitStage
  availability: ExternalPursuitAvailability
  deletionStatus: Exclude<ExternalPursuitDeletionStatus, "deleted">
  /** Role-safe W-110 eligibility signal; it exposes no linked opportunity identity. */
  isOpenCapacity: boolean
  externalUrl: string | null
  targetCompany: string | null
  sourceChannel: string | null
  revenueMeur: number | null
  ebitdaKeur: number | null
  headcount: number | null
  contacts: ExternalPursuitContactInput[]
  nextAction: string | null
  responsibleParty: ExternalPursuitResponsibleParty | null
  dueAt: string | null
  sharedNotes: string | null
  /** Populated only by the staff projection; never sent to the owner portal. */
  staffInternalNotes?: string | null
  updatedAt: string
}
