import { describe, expect, it } from "vitest"
import { parseExplicitDemoClassification } from "@/lib/demo-classification"

describe("explicit staff REAL/DEMO classification", () => {
  it("rejects an omitted classification instead of treating it as REAL", () => {
    expect(parseExplicitDemoClassification(null)).toEqual({ value: null, error: "Choose REAL or DEMO before creating this record." })
  })

  it.each([["real", false], ["demo", true]])("accepts an explicit %s choice", (input, expected) => {
    expect(parseExplicitDemoClassification(input)).toEqual({ value: expected, error: null })
  })

  it("rejects a malformed classification", () => {
    expect(parseExplicitDemoClassification("false")).toEqual({ value: null, error: "Choose REAL or DEMO before creating this record." })
  })
})
