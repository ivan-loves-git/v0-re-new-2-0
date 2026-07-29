import { describe, expect, it } from "vitest"
import {
  canAccessOpportunityMemo,
  canMarkOpportunityInfoMemoReceived,
  getRepreneurMemoAvailability,
  hasCompletedNdaSignature,
  hasStaffDocumentDisclosureApproval,
  safeRepreneurTeaserSummary,
} from "@/lib/opportunity-confidentiality"

const approvedMemo = {
  document_type: "deal_book" as const,
  visibility: "approved_for_repreneur" as const,
  storage_path: "opportunities/opp-1/info-memo.pdf",
  external_url: null,
  repreneur_approved_at: "2026-07-22T08:00:00.000Z",
  repreneur_approved_by: "qa-staff",
}

const signedNda = {
  nda_status: "signed" as const,
  nda_signed_at: "2026-07-22T08:00:00.000Z",
}

describe("opportunity confidentiality gate", () => {
  it("does not treat NDA receipt, a sent NDA, or a signed label alone as permission", () => {
    expect(hasCompletedNdaSignature({ nda_status: "sent" })).toBe(false)
    expect(hasCompletedNdaSignature({ nda_status: "signed" })).toBe(false)
    expect(canAccessOpportunityMemo({ nda_status: "sent" }, approvedMemo)).toBe(false)
    expect(canMarkOpportunityInfoMemoReceived({ nda_status: "signed" }, approvedMemo)).toBe(false)
  })

  it("denies memo access and stage progression when a recorded signed NDA has no real file", () => {
    const missingFileMemo = { ...approvedMemo, storage_path: null }

    expect(canAccessOpportunityMemo(signedNda, missingFileMemo)).toBe(false)
    expect(canMarkOpportunityInfoMemoReceived(signedNda, missingFileMemo)).toBe(false)
  })

  it("permits the approved deal-book memo only after recorded signed evidence and a real file", () => {
    expect(hasCompletedNdaSignature(signedNda)).toBe(true)
    expect(hasStaffDocumentDisclosureApproval(approvedMemo)).toBe(true)
    expect(canAccessOpportunityMemo(signedNda, approvedMemo)).toBe(true)
    expect(canMarkOpportunityInfoMemoReceived(signedNda, approvedMemo)).toBe(true)
  })

  it("requires an explicit staff record for waivers and document approval", () => {
    expect(hasCompletedNdaSignature({ nda_status: "waived" })).toBe(false)
    expect(hasCompletedNdaSignature({
      nda_status: "waived",
      nda_waived_at: "2026-07-22T08:00:00.000Z",
      nda_waived_by: "qa-staff",
    })).toBe(true)
    expect(hasStaffDocumentDisclosureApproval({ ...approvedMemo, repreneur_approved_by: null })).toBe(false)
    expect(canAccessOpportunityMemo(signedNda, { ...approvedMemo, repreneur_approved_at: null })).toBe(false)
  })

  it("keeps non-memo and staff-only documents unavailable after NDA evidence", () => {
    expect(canAccessOpportunityMemo(signedNda, { ...approvedMemo, document_type: "teaser" })).toBe(false)
    expect(canAccessOpportunityMemo(signedNda, { ...approvedMemo, visibility: "staff_only" })).toBe(false)
  })

  it("derives a portal-safe memo explanation from the complete gate rather than document visibility alone", () => {
    expect(getRepreneurMemoAvailability(signedNda, [approvedMemo])).toBe("available")
    expect(getRepreneurMemoAvailability(signedNda, [{ ...approvedMemo, repreneur_approved_at: null }]))
      .toBe("awaiting_document_approval")
    expect(getRepreneurMemoAvailability({ nda_status: "sent" }, [approvedMemo]))
      .toBe("awaiting_confidentiality")
    expect(getRepreneurMemoAvailability({ nda_status: "not_required" }, []))
      .toBe("no_nda_required")
  })

  it("never returns a teaser that is materially the same as the staff description", () => {
    expect(
      safeRepreneurTeaserSummary(
        "Confidential acquisition opportunity: B2B services.",
        " confidential acquisition opportunity b2b services ",
      ),
    ).toBeNull()
    expect(
      safeRepreneurTeaserSummary(
        "Independent B2B services business in France.",
        "Internal note with seller identity and negotiation context.",
      ),
    ).toBe("Independent B2B services business in France.")
  })
})
