import { describe, expect, it } from "vitest"
import {
  NEW_OPPORTUNITY_SECTORS,
  resolveNewOpportunitySector,
} from "@/lib/utils/opportunity-sector"

describe("new opportunity sector selection", () => {
  it("keeps the create-form allowlist aligned with the approved PDR labels", () => {
    expect(NEW_OPPORTUNITY_SECTORS).toEqual([
      "Agroalimentaire",
      "Industrie manufacturière",
      "Industrie lourde",
      "Industrie pharmaceutique & Dispositifs médicaux",
      "Services de santé",
      "Automobile & Mobilité",
      "Textile, Luxe & Mode",
      "Commerce, Négoce & Distribution",
      "BTP & Construction",
      "Services aux entreprises (B2B)",
      "Services aux particuliers (B2C)",
      "Tech & Digital",
      "Environnement & Énergie",
      "Hôtellerie, Restauration & Loisirs",
      "Transport & Logistique",
      "Autre",
    ])
  })

  it.each(NEW_OPPORTUNITY_SECTORS.filter((sector) => sector !== "Autre"))(
    "accepts the approved sector %s",
    (sector) => {
      expect(resolveNewOpportunitySector(sector, null)).toEqual({
        value: sector,
        fieldError: null,
      })
    },
  )

  it("rejects blank and unapproved sector choices", () => {
    expect(resolveNewOpportunitySector(null, null)).toEqual({
      value: null,
      fieldError: {
        field: "sector_choice",
        message: "Select an approved sector.",
      },
    })
    expect(resolveNewOpportunitySector("A made-up sector", null)).toEqual({
      value: null,
      fieldError: {
        field: "sector_choice",
        message: "Select an approved sector.",
      },
    })
  })

  it("requires and trims a specification when Autre is selected", () => {
    expect(resolveNewOpportunitySector("Autre", "   ")).toEqual({
      value: null,
      fieldError: {
        field: "sector_other",
        message: "Specify the other sector.",
      },
    })
    expect(resolveNewOpportunitySector("Autre", "  Économie sociale  ")).toEqual({
      value: "Économie sociale",
      fieldError: null,
    })
  })

  it("caps free-text Autre specifications at 120 characters", () => {
    expect(resolveNewOpportunitySector("Autre", "x".repeat(121))).toEqual({
      value: null,
      fieldError: {
        field: "sector_other",
        message: "Other sector must be 120 characters or fewer.",
      },
    })
  })
})
