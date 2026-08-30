import { describe, expect, it } from "vitest"
import { isDispositionEligiblePdrRequest } from "@/lib/pdr/disposition-eligibility"

const freshDraft = {
  provenance: "proposal" as const,
  status: "draft",
  requesterActor: "Staff",
  requesterUserId: "staff-user-id",
  intakeProvenance: "wave_staff_v1",
  dispositionKind: null,
}

describe("Strategic PDR disposition eligibility", () => {
  it("keeps a newly submitted WAVE draft eligible for Ivan", () => {
    expect(isDispositionEligiblePdrRequest(freshDraft)).toBe(true)
  })

  it.each(["archived", "converted", "parked", "rejected"])("keeps terminal historical %s proposals read-only", (status) => {
    expect(isDispositionEligiblePdrRequest({ ...freshDraft, status })).toBe(false)
  })

  it("does not infer eligibility for legacy or already disposed draft rows", () => {
    expect(isDispositionEligiblePdrRequest({ ...freshDraft, intakeProvenance: null })).toBe(false)
    expect(isDispositionEligiblePdrRequest({ ...freshDraft, requesterActor: "Colin" })).toBe(false)
    expect(isDispositionEligiblePdrRequest({ ...freshDraft, requesterUserId: null })).toBe(false)
    expect(isDispositionEligiblePdrRequest({ ...freshDraft, dispositionKind: "approved" })).toBe(false)
  })
})
