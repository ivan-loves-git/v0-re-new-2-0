import { describe, expect, it } from "vitest"
import { publicAssessmentError, publicIntakeError, publicThesisValidationError } from "@/lib/i18n/form-outcomes"

describe("public form outcomes", () => {
  it("translates a known intake validation outcome without changing the submission", () => {
    expect(publicIntakeError("Sélectionnez au moins un secteur cible.", "en")).toBe("Select at least one target sector.")
    expect(publicIntakeError("La marge EBITDA minimale doit être comprise entre 0 et 100 %.", "en")).toBe("The minimum EBITDA margin must be between 0 and 100%.")
  })

  it("keeps thesis validation actionable in both languages", () => {
    expect(publicThesisValidationError("Geography needs at least one selection.", "fr")).toBe("Sélectionnez au moins une zone géographique.")
    expect(publicThesisValidationError("EBITDA range minimum cannot be greater than its maximum.", "en")).toBe("The minimum EBITDA cannot exceed the maximum.")
  })

  it("never renders an unexpected provider or database message", () => {
    expect(publicIntakeError("SQL connection failed: private detail", "fr")).toBe("Impossible de terminer la candidature. Vérifiez vos réponses et réessayez.")
    expect(publicAssessmentError("provider said secret", "en")).toBe("Could not finish the assessment. Please try again.")
    expect(publicThesisValidationError("provider said secret", "fr")).toBe("Vérifiez les critères de reprise et réessayez.")
  })
})
