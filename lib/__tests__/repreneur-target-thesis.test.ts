import { describe, expect, it } from "vitest"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import {
  canonicalTargetThesisValues,
  legacyTargetThesisValues,
  targetThesisInputValidationMessage,
  targetThesisLabels,
} from "@/lib/repreneur-target-thesis"

describe("target thesis compatibility", () => {
  it("converts historic labels to configured values and preserves a custom geography", () => {
    const geography = canonicalTargetThesisValues(
      ["Ile-de-France", "Auvergne-Rhone-Alpes", "Northern Italy"],
      WHEN_QUESTIONS.q12.options,
      "geography",
    )

    expect(geography).toEqual(["ile-de-france", "auvergne-rhone-alpes", "Northern Italy"])
    expect(legacyTargetThesisValues(geography, WHEN_QUESTIONS.q12.options, "geography")).toEqual(["Northern Italy"])
  })

  it("converts historic sector names and displays configured labels", () => {
    const sectors = canonicalTargetThesisValues(
      ["B2B services", "Digital/IT services", "Logistics", "Light industry"],
      WHEN_QUESTIONS.q13.options,
      "sector",
    )

    expect(sectors).toEqual([
      "Services aux entreprises (B2B)",
      "Tech & Digital",
      "Transport & Logistique",
      "Industrie manufacturière",
    ])
    expect(targetThesisLabels(sectors, WHEN_QUESTIONS.q13.options)).toEqual([
      "Services aux entreprises (B2B)",
      "Tech & Digital",
      "Transport & Logistique",
      "Industrie manufacturière",
    ])
  })

  it("uses only the approved 16 sectors in the current questionnaire", () => {
    expect(WHEN_QUESTIONS.q13.options.map((option) => option.value)).toEqual([
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

  it("returns a clear client-side error for reversed optional ranges", () => {
    const input = {
      q12_geo_zones: ["ile-de-france"],
      q13_target_sectors_v2: ["Tech & Digital"],
      q14_deal_size: ["1-3m"],
      q16_equity: "351-450k",
      target_revenue_min_meur: 10,
      target_revenue_max_meur: 1,
      target_ebitda_margin_min_pct: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
    }

    expect(targetThesisInputValidationMessage(input)).toBe(
      "Revenue range minimum cannot be greater than its maximum.",
    )
    expect(
      targetThesisInputValidationMessage({
        ...input,
        target_revenue_min_meur: 1,
        target_revenue_max_meur: 10,
        target_staff_size_min: 50,
        target_staff_size_max: 10,
      }),
    ).toBe("Staff-size range minimum cannot be greater than its maximum.")
  })

  it("accepts complete criteria with truthful optional ranges", () => {
    expect(
      targetThesisInputValidationMessage({
        q12_geo_zones: ["ile-de-france"],
        q13_target_sectors_v2: ["Tech & Digital"],
        q14_deal_size: ["1-3m"],
        q16_equity: "351-450k",
        target_revenue_min_meur: 1,
        target_revenue_max_meur: 10,
        target_ebitda_margin_min_pct: 15,
        target_staff_size_min: 10,
        target_staff_size_max: 50,
      }),
    ).toBeNull()
  })
})
