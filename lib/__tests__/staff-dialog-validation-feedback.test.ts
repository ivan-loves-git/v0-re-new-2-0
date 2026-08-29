import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("staff dialog validation feedback", () => {
  it("keeps milestone inputs open and explains missing or failed saves", () => {
    const milestones = source("components/offers/offer-milestones.tsx")

    expect(milestones).toContain('setFieldErrors({ title: "Enter a milestone title." })')
    expect(milestones).toContain("<ValidationSummary ref={summaryRef}")
    expect(milestones).toContain('requirement="required">Title</FormFieldLabel>')
    expect(milestones).toContain('requirement="optional">Notes</FormFieldLabel>')
    expect(milestones).toContain('requirement="optional">Due date</FormFieldLabel>')
    expect(milestones).toContain("The milestone could not be added. Check the details and try again.")
    expect(milestones).toContain("The milestone could not be saved. Check the details and try again.")
  })

  it("shows a named error when a decline reason is missing or the update fails", () => {
    const offers = source("components/offers/repreneur-offers-list.tsx")

    expect(offers).toContain("Select the main reason for declining this offer.")
    expect(offers).toContain('<FormFieldLabel htmlFor="engagement-decline-reason" requirement="required">')
    expect(offers).toContain('<FormFieldLabel htmlFor="engagement-decline-details" requirement="optional">')
    expect(offers).toContain("The offer could not be marked as declined. Try again.")
    expect(offers).toContain("<FieldError id=\"engagement-decline-reason\"")
  })

  it("keeps closure failures beside the required reason control", () => {
    const closure = source("components/opportunities/opportunity-closure-controls.tsx")

    expect(closure).toContain('htmlFor="opportunity-closure-reason"')
    expect(closure).toContain('htmlFor="opportunity-pause-reason"')
    expect(closure).toContain('requirement="required"')
    expect(closure).toContain("<ValidationSummary")
    expect(closure).toContain("ref={summaryRef}")
    expect(closure).toContain(
      "setFieldErrors(result.fieldErrors ?? { form: result.message })",
    )
    expect(closure).toContain('id="opportunity-closure-reason"')
    expect(closure).toContain('id="opportunity-pause-reason"')
    expect(closure).toContain("fieldErrors.closure_reason")
    expect(closure).toContain("fieldErrors.pause_reason")
  })
})
