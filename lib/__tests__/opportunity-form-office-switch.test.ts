import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

describe("OpportunityForm office switching", () => {
  it("updates the submitted office and clears stale contacts when staff switch offices", () => {
    const component = readFileSync(
      `${process.cwd()}/components/opportunities/opportunity-form.tsx`,
      "utf8",
    )
    const handlerStart = component.indexOf("function chooseOffice")
    const handlerEnd = component.indexOf(
      "\n  function toggleAffiliation",
      handlerStart,
    )
    const handler = component.slice(handlerStart, handlerEnd)

    expect(handler).toContain(
      'const nextOfficeId = value === NO_OFFICE_OPTION_VALUE ? "" : value',
    )
    expect(handler).toContain("setSelectedOfficeId(nextOfficeId)")
    expect(handler).toContain("setSelectedAffiliationIds([])")
    expect(handler).toContain("setPrimaryAffiliationId(null)")
    expect(component).toContain('name="source_office_id"')
    expect(component).toContain("value={selectedOfficeId}")
  })

  it("uses the committed inline source result to select the new office context", () => {
    const component = readFileSync(
      `${process.cwd()}/components/opportunities/opportunity-form.tsx`,
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
})
