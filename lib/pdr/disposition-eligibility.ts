export type PdrDisposition = "approved" | "declined"

/**
 * A Strategic PDR disposition is only for intake created through the new
 * authenticated WAVE form. Existing PDR proposal statuses are historical
 * workflow evidence, not an invitation to alter the record retroactively.
 */
export const PDR_DISPOSITIONABLE_PROPOSAL_STATUS = "draft"
export const PDR_WAVE_STAFF_INTAKE_PROVENANCE = "wave_staff_v1"

export type PdrDispositionEligibilityInput = {
  provenance: "proposal" | "request"
  status: string
  requesterActor: string
  requesterUserId: string | null
  intakeProvenance: string | null
  dispositionKind: PdrDisposition | null
}

export function isDispositionEligiblePdrRequest(input: PdrDispositionEligibilityInput) {
  return input.provenance === "proposal"
    && input.status === PDR_DISPOSITIONABLE_PROPOSAL_STATUS
    && input.requesterActor === "Staff"
    && Boolean(input.requesterUserId)
    && input.intakeProvenance === PDR_WAVE_STAFF_INTAKE_PROVENANCE
    && input.dispositionKind === null
}
