import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const componentPath =
  `${process.cwd()}/components/opportunities/opportunity-source-context.tsx`

function contactDialogSource() {
  const component = readFileSync(componentPath, "utf8")
  const dialogStart = component.indexOf("open={createContactDialogOpen}")
  expect(dialogStart).toBeGreaterThanOrEqual(0)
  return component.slice(dialogStart)
}


describe("OpportunitySourceContext office contact mode", () => {

  it("creates only a new person from the opportunity source dialog", () => {
    const dialog = contactDialogSource()

    expect(dialog).toContain('name="contact_mode" value="new"')
    expect(dialog).toContain('name="contact_first_name"')
    expect(dialog).toContain('name="contact_last_name"')
    expect(dialog).toContain('name="contact_email"')
    expect(dialog).toContain('name="contact_phone"')
    expect(dialog).toContain("move them from Contacts")
    expect(dialog).not.toContain('name="existing_contact_id"')
    expect(dialog).not.toContain('value="existing"')
    expect(dialog).not.toContain("affiliateableCanonicalContacts")
  })

  it("keeps the compatibility action fail-closed for a second current office", () => {
    const component = readFileSync(componentPath, "utf8")
    const action = readFileSync(
      `${process.cwd()}/lib/actions/opportunity-intake.ts`,
      "utf8",
    )

    expect(component).not.toContain("listMaCanonicalContactOptions")
    expect(component).not.toContain("existing_contact_id")
    expect(action).toContain(
      "This contact already belongs to another current office. Move them from Contacts instead.",
    )
  })
})
