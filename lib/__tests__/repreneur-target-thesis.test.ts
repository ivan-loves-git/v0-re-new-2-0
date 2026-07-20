import { describe, expect, it } from "vitest"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import {
  canonicalTargetThesisValues,
  legacyTargetThesisValues,
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
})
