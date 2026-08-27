import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  isOpportunityInRepreneurNamespace,
  isRepreneurEligibleOpportunity,
} from "@/lib/repreneur-opportunity-eligibility"

describe("repreneur DEMO opportunity eligibility", () => {
  it("allows only an explicitly non-DEMO opportunity", () => {
    expect(isRepreneurEligibleOpportunity({ is_demo: false })).toBe(true)
  })

  it.each([
    ["an explicitly classified DEMO opportunity", { is_demo: true }],
    ["a missing classification", {}],
    ["a null opportunity", null],
    ["an undefined opportunity", undefined],
  ])("fails closed for %s", (_label, opportunity) => {
    expect(isRepreneurEligibleOpportunity(opportunity)).toBe(false)
  })

  it("never infers DEMO state from a title or reference", () => {
    expect(isRepreneurEligibleOpportunity({
      is_demo: false,
      public_title: "DEMO title that is only candidate evidence",
      reference: "TEST-REFERENCE",
    })).toBe(true)
    expect(isRepreneurEligibleOpportunity({
      is_demo: true,
      public_title: "Ordinary title",
      reference: "Re-New - 001",
    })).toBe(false)
  })

  it.each([
    ["REAL to REAL", false, false, true],
    ["DEMO to DEMO", true, true, true],
    ["REAL opportunity to DEMO repreneur", false, true, false],
    ["DEMO opportunity to REAL repreneur", true, false, false],
  ])("enforces %s namespace authority", (_label, opportunityDemo, repreneurDemo, expected) => {
    expect(isOpportunityInRepreneurNamespace(
      { is_demo: opportunityDemo },
      { is_demo: repreneurDemo },
    )).toBe(expected)
  })

  it("fails closed when either namespace classification is missing", () => {
    expect(isOpportunityInRepreneurNamespace({}, { is_demo: false })).toBe(false)
    expect(isOpportunityInRepreneurNamespace({ is_demo: false }, {})).toBe(false)
  })
})
