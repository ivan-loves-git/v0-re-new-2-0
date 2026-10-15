import { describe, expect, it } from "vitest"
import { projectOpportunityPursuitEvidence } from "@/lib/opportunity-pursuit-evidence"

describe("projectOpportunityPursuitEvidence", () => {
  const renew = "renew-current"
  const repreneur = "repreneur-current"

  it("fails closed when the journey switch is disabled", () => {
    const result = projectOpportunityPursuitEvidence({ enabled: false, status: "active_pursuit", events: [], currentTemplateArtifactId: "template", currentRenewArtifactId: renew, currentRepreneurArtifactId: repreneur })
    expect(result.gate2Passed).toBe(false)
    expect(result.nextAction).toBeNull()
  })

  it("requires validation of the exact current signed copies for Gate 2", () => {
    const result = projectOpportunityPursuitEvidence({
      enabled: true, status: "active_pursuit", currentTemplateArtifactId: "template", currentRenewArtifactId: renew, currentRepreneurArtifactId: repreneur, currentGate1EventId: "gate1",
      events: [
        { id: "cycle", event_type: "mutual_interest_validated", nda_artifact_id: null },
        { event_type: "e4_qualification_requested", nda_artifact_id: null, metadata: { handoff_delivery_id: "provider-delivery", provider_message_id: "accepted-provider-receipt", upstream_evidence_id: "cycle" } },
        { event_type: "intermediary_qualified", nda_artifact_id: null },
        { event_type: "template_validated", nda_artifact_id: "template" },
        { id: "gate1", event_type: "gate_1_passed", nda_artifact_id: null },
        { event_type: "e6_nda_ready_notified", nda_artifact_id: null, metadata: { handoff_delivery_id: "provider-delivery", provider_message_id: "accepted-provider-receipt", upstream_evidence_id: "gate1" } },
        { event_type: "renew_signed_copy_validated", nda_artifact_id: "renew-old" },
        { event_type: "repreneur_signed_copy_validated", nda_artifact_id: repreneur },
        { event_type: "gate_2_passed", nda_artifact_id: null },
      ],
    })
    expect(result.hasCurrentRenewCopy).toBe(false)
    expect(result.gate2Passed).toBe(false)
    expect(result.nextAction).toBe("validate_renew_copy")
  })

  it("permits a confidential grant only after canonical gate evidence", () => {
    const result = projectOpportunityPursuitEvidence({
      enabled: true, status: "active_pursuit", currentTemplateArtifactId: "template", currentRenewArtifactId: renew, currentRepreneurArtifactId: repreneur, currentGate1EventId: "gate1", currentGate2EventId: "gate2",
      events: [
        { id: "cycle", event_type: "mutual_interest_validated", nda_artifact_id: null },
        { event_type: "e4_qualification_requested", nda_artifact_id: null, metadata: { handoff_delivery_id: "provider-delivery", provider_message_id: "accepted-provider-receipt", upstream_evidence_id: "cycle" } },
        { event_type: "intermediary_qualified", nda_artifact_id: null },
        { event_type: "template_validated", nda_artifact_id: "template" },
        { id: "gate1", event_type: "gate_1_passed", nda_artifact_id: null },
        { event_type: "e6_nda_ready_notified", nda_artifact_id: null, metadata: { handoff_delivery_id: "provider-delivery", provider_message_id: "accepted-provider-receipt", upstream_evidence_id: "gate1" } },
        { event_type: "renew_signed_copy_validated", nda_artifact_id: renew },
        { event_type: "repreneur_signed_copy_validated", nda_artifact_id: repreneur },
        { id: "gate2", event_type: "gate_2_passed", nda_artifact_id: null },
      ],
    })
    expect(result.canGrantConfidentialAccess).toBe(false)
    expect(result.nextAction).toBe("record_dispatch")
  })
  it("accepts new protected external E6 and never promotes an old manual note", () => {
    const events = [
      { id: "cycle", event_type: "mutual_interest_validated" as const, nda_artifact_id: null },
      { event_type: "e4_qualification_requested" as const, nda_artifact_id: null, metadata: { upstream_evidence_id: "cycle", handoff_delivery_id: "delivered-e4", provider_message_id: "accepted-e4" } },
      { event_type: "intermediary_qualified" as const, nda_artifact_id: null },
      { event_type: "template_validated" as const, nda_artifact_id: "template" },
      { id: "gate1", event_type: "gate_1_passed" as const, nda_artifact_id: null },
      { event_type: "e6_nda_ready_notified" as const, nda_artifact_id: null, metadata: { upstream_evidence_id: "gate1", qualifying_origin: "external_staff_v1", external_handoff_id: "protected-receipt", operation_key: "same-key", context: { documents: ["current-template"] } } },
    ]
    const external = projectOpportunityPursuitEvidence({ enabled: true, status: "active_pursuit", events, currentTemplateArtifactId: "template", currentGate1EventId: "gate1" })
    expect(external.ndaReadyNotified).toBe(true)
    expect(external.nextAction).toBe("validate_renew_copy")
    const historical = projectOpportunityPursuitEvidence({ enabled: true, status: "active_pursuit", events: [...events.slice(0, -1), { event_type: "e6_nda_ready_notified", nda_artifact_id: null, metadata: { upstream_evidence_id: "gate1" } }], currentTemplateArtifactId: "template", currentGate1EventId: "gate1" })
    expect(historical.ndaReadyNotified).toBe(false)
    expect(historical.nextAction).toBe("send_nda_ready")
  })

})
