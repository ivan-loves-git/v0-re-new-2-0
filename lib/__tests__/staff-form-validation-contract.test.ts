import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  `${process.cwd()}/components/forms/validation-feedback.tsx`,
  "utf8",
)
const opportunityForm = readFileSync(
  `${process.cwd()}/components/opportunities/opportunity-form.tsx`,
  "utf8",
)
const sourceReview = readFileSync(
  `${process.cwd()}/components/opportunities/opportunity-source-review-panel.tsx`,
  "utf8",
)
const opportunityMatches = readFileSync(
  `${process.cwd()}/components/opportunities/opportunity-matches-panel.tsx`,
  "utf8",
)

describe("staff form validation feedback contract", () => {
  it("explains required, optional, and conditional fields in words", () => {
    expect(source).toContain('type Requirement = "required" | "optional" | "conditional"')
    expect(source).toContain('"Required"')
    expect(source).toContain('"Optional"')
    expect(source).toContain('"Required for this step"')
  })

  it("binds named field errors accessibly and never relies on colour alone", () => {
    expect(source).toContain('role="alert"')
    expect(source).toContain('"aria-invalid": Boolean(message)')
    expect(source).toContain('"aria-describedby"')
    expect(source).toContain('<CircleAlert')
  })

  it("provides a focusable linked summary for invalid Save or Next attempts", () => {
    expect(source).toContain('tabIndex={-1}')
    expect(source).toContain('href={`#${field}`}')
    expect(source).toContain('requestAnimationFrame')
  })

  it("uses the shared feedback contract on active opportunity-domain staff forms", () => {
    for (const form of [opportunityForm, sourceReview, opportunityMatches]) {
      expect(form).toContain("ValidationSummary")
      expect(form).toContain("focusValidationSummary")
      expect(form).toContain("FormFieldLabel")
      expect(form).toContain("FieldError")
    }
  })
})
