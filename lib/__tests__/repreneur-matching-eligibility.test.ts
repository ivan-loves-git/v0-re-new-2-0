import { describe, expect, it } from "vitest"
import {
  hasInvitedLinkedIdentity,
  isAcceptedPaidMatchingClient,
  isEligibleForManualRecommendation,
} from "@/lib/repreneur-matching-eligibility"

const acceptedEndToEnd = [{ status: "accepted", offer: { name: "End-to-End", price: 0 } }]

describe("matching client eligibility", () => {
  it("allows a qualified, free invited repreneur to receive a staff recommendation", () => {
    expect(isEligibleForManualRecommendation({ is_demo: false })).toBe(true)
    expect(hasInvitedLinkedIdentity({ role: "repreneur", repreneur_id: "rep-1", user_id: "user-1" }, "rep-1")).toBe(true)
  })

  it("keeps DEMO or uninvited profiles out of manual recommendations", () => {
    expect(isEligibleForManualRecommendation({ is_demo: true })).toBe(false)
    expect(hasInvitedLinkedIdentity({ role: "repreneur", repreneur_id: "rep-1", user_id: null }, "rep-1")).toBe(false)
  })

  it("excludes a Test2Colin-like profile despite a normal accepted End-to-End offer", () => {
    expect(isAcceptedPaidMatchingClient({ first_name: "Test2Colin", last_name: "Repreneur" }, acceptedEndToEnd)).toBe(false)
  })

  it("keeps a real accepted End-to-End client eligible", () => {
    expect(isAcceptedPaidMatchingClient({ first_name: "Colin", last_name: "Martin" }, acceptedEndToEnd)).toBe(true)
  })

  it("excludes an explicitly classified DEMO profile without relying on its display name", () => {
    expect(isAcceptedPaidMatchingClient({ first_name: "Ari", last_name: "Martin", is_demo: true }, acceptedEndToEnd)).toBe(false)
  })

  it("keeps an accepted paid Deal Flow client eligible", () => {
    expect(isAcceptedPaidMatchingClient(
      { first_name: "Ada", last_name: "Martin" },
      [{ status: "accepted", offer: { name: "Deal Flow - Paid", price: 500 } }],
    )).toBe(true)
  })

  it.each([
    { assignment: { status: "accepted", offer: { name: "Deal Flow - Free", price: 0 } } },
    { assignment: { status: "declined", offer: { name: "Deal Flow - Paid", price: 500 } } },
    { assignment: { status: "accepted", offer: { name: "TEST Deal Flow", price: 500 } } },
  ])("excludes a free, declined, or test offer", ({ assignment }) => {
    expect(isAcceptedPaidMatchingClient({ first_name: "Ada", last_name: "Martin" }, [assignment])).toBe(false)
  })
})
