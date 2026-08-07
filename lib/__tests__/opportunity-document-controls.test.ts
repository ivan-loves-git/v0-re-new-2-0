import { describe, expect, it } from "vitest"
import {
  assertGenericOpportunityDocumentPolicy,
  getOpportunityDocumentPolicy,
} from "@/lib/opportunity-document-policy"

function pdf(name = "document.pdf") {
  return new File(["pdf"], name, { type: "application/pdf" })
}

function textFile(name = "document.txt") {
  return new File(["text"], name, { type: "text/plain" })
}

describe("opportunity document controls", () => {
  it("rejects non-PDF source teasers and IMs", () => {
    expect(() => assertGenericOpportunityDocumentPolicy("source_teaser", "staff_only", textFile(), null)).toThrow("must be uploaded as a PDF")
    expect(() => assertGenericOpportunityDocumentPolicy("deal_book", "staff_only", textFile(), null)).toThrow("must be uploaded as a PDF")
    expect(() => assertGenericOpportunityDocumentPolicy("deal_book", "staff_only", pdf(), "https://example.test/memo.pdf")).toThrow("must be uploaded as a PDF")
  })

  it("rejects generic repreneur approval for retained source or IM documents", () => {
    expect(() => assertGenericOpportunityDocumentPolicy("source_teaser", "approved_for_repreneur", pdf(), null)).toThrow("stay staff-only")
    expect(() => assertGenericOpportunityDocumentPolicy("deal_book", "approved_for_repreneur", pdf(), null)).toThrow("stay staff-only")
  })

  it("requires a new row rather than generic replacement or deletion of retained documents", () => {
    for (const documentType of ["source_teaser", "deal_book"] as const) {
      const policy = getOpportunityDocumentPolicy(documentType)
      expect(policy.retained).toBe(true)
      expect(policy.canRemove).toBe(false)
      expect(policy.canReplace).toBe(false)
      expect(policy.canChangeVisibility).toBe(false)
      expect(policy.requiresPdf).toBe(true)
    }
  })

  it("preserves CV/LdC-compatible mutable policy for ordinary documents", () => {
    const policy = getOpportunityDocumentPolicy("other")
    expect(policy.canRemove).toBe(true)
    expect(policy.canChangeVisibility).toBe(true)
  })
})
