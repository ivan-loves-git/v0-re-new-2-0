import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { isRepreneurEligibleOpportunity } from "@/lib/repreneur-opportunity-eligibility"

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
})
