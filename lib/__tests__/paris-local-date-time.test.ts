import { describe, expect, it } from "vitest"
import { parisInstantsForLocal, parisLocalInputNow } from "@/lib/utils/paris-local-date-time"

describe("explicit Paris receipt clock", () => {
  it("formats the same instant as Paris civil time independent of host TZ", () => {
    expect(parisLocalInputNow(new Date("2026-09-22T12:33:40.987Z"))).toBe("2026-09-22T14:33:40")
    expect(parisInstantsForLocal("2026-09-22T14:33:40")).toEqual(["2026-09-22T12:33:40.000Z"])
    expect(parisInstantsForLocal("2026-09-22T14:33:40.987")).toEqual(["2026-09-22T12:33:40.987Z"])
  })
  it("rejects the spring gap and exposes both autumn-fold instants", () => {
    expect(parisInstantsForLocal("2026-03-29T02:30")).toEqual([])
    expect(parisInstantsForLocal("2026-10-25T02:30")).toEqual([
      "2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z",
    ])
  })
  it("does not normalize invalid dates", () => {
    expect(parisInstantsForLocal("2026-02-31T10:00")).toEqual([])
  })
})
