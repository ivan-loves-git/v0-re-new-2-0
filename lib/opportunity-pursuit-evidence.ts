import "server-only"

export const PURSUIT_EVIDENCE_TYPES = [
  "mutual_interest_validated", "qualification_requested", "intermediary_qualified",
  "template_validated", "gate_1_passed", "renew_signed_copy_validated",
  "repreneur_signed_copy_validated", "gate_2_passed", "manual_package_dispatched",
  "confidential_access_granted", "access_revoked", "continued", "dropped", "reopened", "completed",
] as const

export type OpportunityPursuitEvidenceType = (typeof PURSUIT_EVIDENCE_TYPES)[number]
export type OpportunityPursuitJourneyAction =
  | "request_qualification" | "qualify" | "validate_template" | "pass_gate_1" | "validate_renew_copy"
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
  currentCycleId: string | null
  steps: Array<{ key: string; label: string; status: "complete" | "current" | "blocked" | "not_available"; recordedAt?: string; actor?: string; artifactId?: string; artifactVersion?: number; blocker?: string }>
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
  events: Array<Pick<OpportunityPursuitEvidence, "event_type" | "nda_artifact_id"> & Partial<Pick<OpportunityPursuitEvidence, "id" | "recorded_at" | "actor">>>
  currentRenewArtifactId?: string | null
  currentRepreneurArtifactId?: string | null
  artifactVersions?: Record<string, number>
}): OpportunityPursuitProjection {
  const cycleStart = [...input.events].reverse().find((event) => event.event_type === "mutual_interest_validated")
  const cycleEvents = cycleStart ? input.events.slice(input.events.indexOf(cycleStart)) : []
  const eventTypes = new Set(cycleEvents.map((event) => event.event_type))
  const hasCurrentRenewCopy = Boolean(input.currentRenewArtifactId && cycleEvents.some((event) =>
    event.event_type === "renew_signed_copy_validated" && event.nda_artifact_id === input.currentRenewArtifactId,
  ))
  const hasCurrentRepreneurCopy = Boolean(input.currentRepreneurArtifactId && cycleEvents.some((event) =>
    event.event_type === "repreneur_signed_copy_validated" && event.nda_artifact_id === input.currentRepreneurArtifactId,
  ))
  const gate1Passed = eventTypes.has("gate_1_passed")
  const gate2Passed = eventTypes.has("gate_2_passed") && hasCurrentRenewCopy && hasCurrentRepreneurCopy
  const dispatched = eventTypes.has("manual_package_dispatched")
  const active = input.enabled && input.status === "active_pursuit"
  const nextAction = !active ? null
    : !eventTypes.has("qualification_requested") ? "request_qualification"
    : !eventTypes.has("intermediary_qualified") ? "qualify"
    : !eventTypes.has("template_validated") ? "validate_template"
    : !gate1Passed ? "pass_gate_1"
    : !hasCurrentRenewCopy ? "validate_renew_copy"
    : !hasCurrentRepreneurCopy ? "validate_repreneur_copy"
    : !gate2Passed ? "pass_gate_2"
    : !dispatched ? "record_dispatch"
    : "grant_confidential_access"
  const recorded = (key: string) => cycleEvents.find((event) => event.event_type === key)
  const stepAction: Record<string, OpportunityPursuitJourneyAction | undefined> = { qualification_requested: "request_qualification", intermediary_qualified: "qualify", template_validated: "validate_template", gate_1_passed: "pass_gate_1", renew_signed_copy_validated: "validate_renew_copy", repreneur_signed_copy_validated: "validate_repreneur_copy", gate_2_passed: "pass_gate_2", manual_package_dispatched: "record_dispatch", confidential_access_granted: "grant_confidential_access" }
  const state = (key: string, available: boolean, blocker: string) => {
    const event = recorded(key)
    return { key, label: key.replaceAll("_", " "), status: event ? "complete" as const : !available ? "not_available" as const : nextAction === stepAction[key] ? "current" as const : "blocked" as const, recordedAt: event?.recorded_at, actor: event?.actor, artifactId: event?.nda_artifact_id ?? undefined, artifactVersion: event?.nda_artifact_id ? input.artifactVersions?.[event.nda_artifact_id] : undefined, blocker: event ? undefined : blocker }
  }
  const steps = [state("mutual_interest_validated", active, "Start an active pursuit first."), state("qualification_requested", active, "Record the qualification request."), state("intermediary_qualified", active, "Qualification is required."), state("template_validated", active, "Validate the current blank template."), state("gate_1_passed", active, "Qualification and the current template are required."), state("renew_signed_copy_validated", gate1Passed, "Gate 1 is required."), state("repreneur_signed_copy_validated", gate1Passed, "Gate 1 is required."), state("gate_2_passed", hasCurrentRenewCopy && hasCurrentRepreneurCopy, "Validate both current signed copies."), state("manual_package_dispatched", gate2Passed, "Gate 2 is required."), state("confidential_access_granted", dispatched, "Record manual dispatch first.")]
  return { currentCycleId: cycleStart?.id ?? null, steps, gate1Passed, gate2Passed, hasCurrentRenewCopy, hasCurrentRepreneurCopy, dispatched, canGrantConfidentialAccess: active && gate2Passed && dispatched, nextAction }
}
