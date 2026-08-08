export type MaRelationshipActivityProvenance = "manual" | "system-recorded"

export interface MaRelationshipActivityEvidence {
  deliveryStatus: "pending" | "sent" | "failed" | null
  providerIdempotencyKey: string | null
  providerMessageId: string | null
  deliveryFinalizedAt: string | null
  sentAt: string | null
}

function hasText(value: string | null) {
  return Boolean(value?.trim())
}

/**
 * The interaction ledger is the evidence boundary. Manual staff records have
 * no provider delivery evidence; WAVE-created delivery attempts retain a
 * provider idempotency key and their persisted outcome. Do not infer a send
 * from an email channel, direction, recipient, or staff-authored summary.
 */
export function activityProvenance(
  evidence: MaRelationshipActivityEvidence,
): MaRelationshipActivityProvenance {
  return evidence.deliveryStatus && hasText(evidence.providerIdempotencyKey)
    ? "system-recorded"
    : "manual"
}

export function hasConfirmedProviderDelivery(
  evidence: MaRelationshipActivityEvidence,
) {
  return (
    evidence.deliveryStatus === "sent" &&
    hasText(evidence.providerIdempotencyKey) &&
    hasText(evidence.providerMessageId) &&
    Boolean(evidence.deliveryFinalizedAt) &&
    Boolean(evidence.sentAt)
  )
}
