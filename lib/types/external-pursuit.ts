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

export interface ExternalPursuitActionResult {
  success: boolean
  message: string
  pursuitId?: string
}
