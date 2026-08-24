import { describe, expect, it } from "vitest"
import { isAcceptedPaidMatchingClient } from "@/lib/repreneur-matching-eligibility"

const acceptedEndToEnd = [{ status: "accepted", offer: { name: "End-to-End", price: 0 } }]

describe("matching client eligibility", () => {
  it("excludes a Test2Colin-like profile despite a normal accepted End-to-End offer", () => {
    expect(isAcceptedPaidMatchingClient({ first_name: "Test2Colin", last_name: "Repreneur" }, acceptedEndToEnd)).toBe(false)
  })

  it("keeps a real accepted End-to-End client eligible", () => {
    expect(isAcceptedPaidMatchingClient({ first_name: "Colin", last_name: "Martin" }, acceptedEndToEnd)).toBe(true)
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
