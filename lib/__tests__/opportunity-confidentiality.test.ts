import { describe, expect, it } from "vitest"
import {
  canAccessOpportunityMemo,
  canMarkOpportunityInfoMemoReceived,
  hasCompletedNdaSignature,
} from "@/lib/opportunity-confidentiality"

const approvedMemo = {
  document_type: "deal_book" as const,
  visibility: "approved_for_repreneur" as const,
  storage_path: "opportunities/opp-1/info-memo.pdf",
  external_url: null,
}

describe("opportunity confidentiality gate", () => {
  it("does not treat NDA receipt or a sent NDA as permission to access the memo", () => {
    expect(hasCompletedNdaSignature("sent")).toBe(false)
    expect(canAccessOpportunityMemo("sent", approvedMemo)).toBe(false)
    expect(canMarkOpportunityInfoMemoReceived("sent", approvedMemo)).toBe(false)
  })

  it("denies memo access and stage progression when a signed NDA has no real file", () => {
    const missingFileMemo = { ...approvedMemo, storage_path: null }

    expect(canAccessOpportunityMemo("signed", missingFileMemo)).toBe(false)
    expect(canMarkOpportunityInfoMemoReceived("signed", missingFileMemo)).toBe(false)
  })

  it("permits the approved deal-book memo only after a signed NDA and a real file", () => {
    expect(hasCompletedNdaSignature("signed")).toBe(true)
    expect(canAccessOpportunityMemo("signed", approvedMemo)).toBe(true)
    expect(canMarkOpportunityInfoMemoReceived("signed", approvedMemo)).toBe(true)
  })

  it("keeps non-memo and staff-only documents unavailable after signature", () => {
    expect(canAccessOpportunityMemo("signed", { ...approvedMemo, document_type: "teaser" })).toBe(false)
    expect(canAccessOpportunityMemo("signed", { ...approvedMemo, visibility: "staff_only" })).toBe(false)
  })
})
