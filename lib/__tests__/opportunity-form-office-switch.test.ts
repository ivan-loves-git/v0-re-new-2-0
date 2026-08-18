import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

describe("OpportunityForm office switching", () => {
  it("updates the submitted office and clears stale contacts when staff switch offices", () => {
    const component = readFileSync(
      `${process.cwd()}/components/opportunities/opportunity-source-context.tsx`,
      "utf8",
    )
    const handlerStart = component.indexOf("function chooseOffice")
    const handlerEnd = component.indexOf(
      "\n  function toggleAffiliation",
      handlerStart,
    )
    const handler = component.slice(handlerStart, handlerEnd)

    expect(handler).toContain("resolveOpportunityOfficeChoice(")
    expect(handler).toContain("if (nextOfficeId === null) return")
    expect(handler).toContain("setSelectedOfficeId(nextOfficeId)")
    expect(handler).toContain("setSelectedAffiliationIds([])")
    expect(handler).toContain("setPrimaryAffiliationId(null)")
    expect(component).toContain('name="source_office_id"')
    expect(component).toContain("value={selectedOfficeId}")
  })

  it("uses the committed inline source result to select the new office context", () => {
    const component = readFileSync(
      `${process.cwd()}/components/opportunities/opportunity-source-context.tsx`,
      "utf8",
    )
    const handlerStart = component.indexOf("async function handleCreateOfficeContext")
    const handlerEnd = component.indexOf(
      "\n  async function handleCreateOfficeContact",
      handlerStart,
    )
    const handler = component.slice(handlerStart, handlerEnd)

    expect(handler).toContain("if (!result.success || !result.office)")
    expect(handler).toContain(
      "const selection = selectCreatedOfficeContext(office, officeContextMode)",
    )
    expect(handler).toContain("setSelectedOfficeId(selection.selectedOfficeId)")
    expect(handler).toContain("setSelectedAffiliationIds(selection.affiliationIds)")
    expect(handler).toContain(
      "setPrimaryAffiliationId(selection.primaryAffiliationId)",
    )
  })

  it("keeps a month-only source date unless staff explicitly confirms its exact day", () => {
    const component = readFileSync(
      `${process.cwd()}/components/opportunities/opportunity-form.tsx`,
      "utf8",
    )
    const action = readFileSync(
      `${process.cwd()}/lib/actions/opportunity-intake.ts`,
      "utf8",
    )

    expect(component).toContain('opportunity?.date_added_precision === "month"')
    expect(component).toContain('name="date_added_preserve_month"')
    expect(component).toContain('name="date_added_confirm_day"')
    expect(component).toContain('name="date_added_clear"')
    expect(component).toContain(
      "I have verified the exact calendar day.",
    )
    expect(component).toContain("Source recorded:")
    expect(component).toContain("Confirming replaces the month-only source")
    expect(action).toContain("dateAddedPreserveMonth")
    expect(action).toContain("date_added_confirm_day?: boolean")
    expect(action).toContain(
      'readOpportunityFormString(formData, "date_added_confirm_day") === "on"',
    )
  })
})
