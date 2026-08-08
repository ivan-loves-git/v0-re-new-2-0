import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

describe("staff people and offer form validation", () => {
  it("uses custom linked validation for the repreneur core profile", () => {
    const form = source("components/repreneurs/repreneur-form.tsx")
    const actions = source("lib/actions/repreneurs.ts")

    expect(form).toContain('className="mx-auto max-w-4xl" noValidate')
    expect(form).toContain("<ValidationSummary")
    expect(form).toContain('requirement="required">First name')
    expect(form).toContain('requirement="required">Last name')
    expect(form).toContain('requirement="required">Email')
    expect(form).toContain('nextErrors.linkedin_url = "Enter a complete web address')
    expect(actions).toContain('if (!firstName) throw new Error("Enter a first name.")')
    expect(actions).toContain('if (field === "email")')
  })

  it("validates every constrained offer number without native-only bubbles", () => {
    const form = source("components/offers/offer-form.tsx")
    const actions = source("lib/actions/offers.ts")

    expect(form).toContain('className="space-y-6" noValidate')
    expect(form).toContain("errors.acceptance_deadline_days")
    expect(form).toContain("errors.includes_hours")
    expect(actions).toContain("Acceptance deadline must be at least one day.")
    expect(actions).toContain("Coaching hours must be a whole number of zero or more.")
  })

  it("does not invent questionnaire requirements beyond the approved sector rule", () => {
    const form = source("components/repreneurs/questionnaire-form-v2.tsx")

    expect(form).toContain('q13_target_sectors_v2: "Target sectors"')
    expect(form).toContain("Select at least one approved sector.")
    expect(form).toContain("Other answers are optional and improve the scoring preview.")
  })

  it("covers the active quick and inline staff entry surfaces", () => {
    const files = [
      "components/repreneurs/repreneur-opportunity-matches-card.tsx",
      "components/repreneurs/editable-repreneur-identity.tsx",
      "components/repreneurs/repreneur-notes.tsx",
      "components/repreneurs/activity-history.tsx",
    ]

    for (const file of files) {
      const component = source(file)
      expect(component).toContain("FieldError")
      expect(component).toContain("FormFieldLabel")
    }
  })
})
