import "server-only"

export const PURSUIT_EVIDENCE_TYPES = [
  "mutual_interest_validated", "qualification_requested", "intermediary_qualified",
  "template_validated", "gate_1_passed", "renew_signed_copy_validated",
  "repreneur_signed_copy_validated", "gate_2_passed", "manual_package_dispatched",
  "confidential_access_granted", "access_revoked", "continued", "dropped", "reopened", "completed",
] as const

export type OpportunityPursuitEvidenceType = (typeof PURSUIT_EVIDENCE_TYPES)[number]
export type OpportunityPursuitJourneyAction =
  | "qualify" | "validate_template" | "pass_gate_1" | "validate_renew_copy"
  | "validate_repreneur_copy" | "pass_gate_2" | "record_dispatch" | "continue"
  | "drop" | "reopen" | "complete" | "grant_confidential_access" | "revoke_access"

export interface OpportunityPursuitEvidence {
  id: string
  match_id: string
  opportunity_id: string
  repreneur_id: string
  event_type: OpportunityPursuitEvidenceType
  actor: string
  evidence_reference?: string | null
  nda_artifact_id?: string | null
  document_id?: string | null
  idempotency_key: string
  recorded_at: string
}

export interface OpportunityPursuitProjection {
  gate1Passed: boolean
  gate2Passed: boolean
  hasCurrentRenewCopy: boolean
  hasCurrentRepreneurCopy: boolean
  dispatched: boolean
  canGrantConfidentialAccess: boolean
  nextAction: OpportunityPursuitJourneyAction | null
}

export function projectOpportunityPursuitEvidence(input: {
  enabled: boolean
  status: string
  events: Pick<OpportunityPursuitEvidence, "event_type" | "nda_artifact_id">[]
  currentRenewArtifactId?: string | null
  currentRepreneurArtifactId?: string | null
}): OpportunityPursuitProjection {
  const eventTypes = new Set(input.events.map((event) => event.event_type))
  const hasCurrentRenewCopy = Boolean(input.currentRenewArtifactId && input.events.some((event) =>
    event.event_type === "renew_signed_copy_validated" && event.nda_artifact_id === input.currentRenewArtifactId,
  ))
  const hasCurrentRepreneurCopy = Boolean(input.currentRepreneurArtifactId && input.events.some((event) =>
    event.event_type === "repreneur_signed_copy_validated" && event.nda_artifact_id === input.currentRepreneurArtifactId,
  ))
  const gate1Passed = eventTypes.has("gate_1_passed")
  const gate2Passed = eventTypes.has("gate_2_passed") && hasCurrentRenewCopy && hasCurrentRepreneurCopy
  const dispatched = eventTypes.has("manual_package_dispatched")
  const active = input.enabled && input.status === "active_pursuit"
  const nextAction = !active ? null
    : !eventTypes.has("intermediary_qualified") ? "qualify"
    : !eventTypes.has("template_validated") ? "validate_template"
    : !gate1Passed ? "pass_gate_1"
    : !hasCurrentRenewCopy ? "validate_renew_copy"
    : !hasCurrentRepreneurCopy ? "validate_repreneur_copy"
    : !gate2Passed ? "pass_gate_2"
    : !dispatched ? "record_dispatch"
    : "grant_confidential_access"
  return { gate1Passed, gate2Passed, hasCurrentRenewCopy, hasCurrentRepreneurCopy, dispatched, canGrantConfidentialAccess: active && gate2Passed && dispatched, nextAction }
}
