import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const componentPath =
  `${process.cwd()}/components/opportunities/opportunity-form.tsx`

function contactDialogSource() {
  const component = readFileSync(componentPath, "utf8")
  const dialogStart = component.indexOf("open={createContactDialogOpen}")
  expect(dialogStart).toBeGreaterThanOrEqual(0)
  return component.slice(dialogStart)
}

describe("OpportunityForm office contact mode", () => {
  it("makes existing-contact affiliation and new-person creation mutually exclusive", () => {
    const dialog = contactDialogSource()
    const existingModeStart = dialog.indexOf('{contactMode === "existing" ? (')
    const newModeStart = dialog.indexOf(") : (", existingModeStart)

    expect(dialog).toContain('value="existing"')
    expect(dialog).toContain('value="new"')
    expect(existingModeStart).toBeGreaterThanOrEqual(0)
    expect(newModeStart).toBeGreaterThan(existingModeStart)

    const existingMode = dialog.slice(existingModeStart, newModeStart)
    const newMode = dialog.slice(newModeStart)

    expect(existingMode).toContain('name="existing_contact_id"')
    expect(existingMode).toContain("affiliateableCanonicalContacts.map")
    expect(existingMode).toContain("value={contact.contact_id}")
    expect(existingMode).not.toContain('name="contact_first_name"')
    expect(existingMode).not.toContain('name="contact_last_name"')
    expect(existingMode).not.toContain('name="contact_email"')
    expect(existingMode).not.toContain('name="contact_phone"')

    expect(newMode).toContain('name="contact_first_name"')
    expect(newMode).toContain('name="contact_last_name"')
    expect(newMode).toContain('name="contact_email"')
    expect(newMode).toContain('name="contact_phone"')
  })

  it("loads canonical contacts through the staff action and excludes the selected office's contacts", () => {
    const component = readFileSync(componentPath, "utf8")
    const action = readFileSync(
      `${process.cwd()}/lib/actions/opportunity-intake.ts`,
      "utf8",
    )

    expect(component).toContain("listMaCanonicalContactOptions")
    expect(component).toContain("loadCanonicalContactOptions")
    expect(component).toContain("selectedOffice?.contacts.map")
    expect(component).toContain("!selectedOfficeContactIds.has(contact.contact_id)")
    expect(action).toContain(
      "This canonical contact is already affiliated with the selected office.",
    )
  })
})
