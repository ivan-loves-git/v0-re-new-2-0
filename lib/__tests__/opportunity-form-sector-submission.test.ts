import { describe, expect, it } from "vitest"
import { setOpportunitySectorChoiceForSubmission } from "@/lib/utils/opportunity-sector"

describe("OpportunityForm optional sector submission", () => {
  it("serializes an untouched optional sector as an explicit blank value", () => {
    const formData = new FormData()
    formData.set("sector_choice", "Agroalimentaire")

    setOpportunitySectorChoiceForSubmission(formData, "")

    expect(formData.getAll("sector_choice")).toEqual([""])
  })

  it("serializes the exact sector explicitly selected by staff", () => {
    const formData = new FormData()

    setOpportunitySectorChoiceForSubmission(
      formData,
      "Services aux entreprises (B2B)",
    )

    expect(formData.getAll("sector_choice")).toEqual([
      "Services aux entreprises (B2B)",
    ])
  })
})
