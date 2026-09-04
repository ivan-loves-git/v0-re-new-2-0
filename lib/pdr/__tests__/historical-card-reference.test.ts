import { describe, expect, it } from "vitest"

import {
  parseHistoricalWorkCardReference,
  resolveHistoricalWorkCardReference,
} from "@/lib/pdr/historical-card-reference"

describe("historical work-card reference resolver", () => {
  it("accepts exactly one canonical W reference and resolves its matching frozen record", () => {
    expect(parseHistoricalWorkCardReference("W-167")).toBe(167)
    expect(resolveHistoricalWorkCardReference(167, [{ id: "card-167", referenceNumber: 167 }]))
      .toEqual({ id: "card-167", referenceNumber: 167 })
  })

  it("does not turn malformed, ambiguous, or alternate identifiers into a lookup", () => {
    for (const value of [undefined, ["W-167"], "w-167", "W-0", "W-167 ", "W-167&owner=1", "card-167"]) {
      expect(parseHistoricalWorkCardReference(value)).toBeNull()
    }
    expect(resolveHistoricalWorkCardReference(167, [{ id: "other", referenceNumber: 168 }])).toBeNull()
  })
})
