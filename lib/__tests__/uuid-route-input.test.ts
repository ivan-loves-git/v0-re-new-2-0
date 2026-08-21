import { describe, expect, it } from "vitest"
import { isUuid } from "@/lib/uuid"

describe("UUID route input", () => {
  it("accepts canonical UUID values used by persisted records", () => {
    expect(isUuid("018f62b4-6500-7f65-9afb-8f0ea8cd4ba9")).toBe(true)
  })

  it("rejects malformed and blank values before a database query", () => {
    for (const value of ["", "not-a-uuid", "../../opportunity", "018f62b4-6500-7f65-9afb-8f0ea8cd4ba"]) {
      expect(isUuid(value)).toBe(false)
    }
  })
})
