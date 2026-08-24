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

function labeledInputSource(form: string, id: string) {
  const idStart = form.indexOf(`id="${id}"`)
  expect(idStart).toBeGreaterThanOrEqual(0)
  const start = form.lastIndexOf("<LabeledInput", idStart)
  expect(start).toBeGreaterThanOrEqual(0)
  return form.slice(start, form.indexOf("/>", start) + 2)
}

describe("OpportunitySourceContext office contact mode", () => {
  it("states the same conditional name rule in both staff contact-entry forms", () => {
    const component = readFileSync(componentPath, "utf8")
    const newFirmStart = component.indexOf('{officeContextMode === "new_firm" ? (')
    const officeContactStart = component.indexOf('open={createContactDialogOpen}')
    const labeledInputStart = component.indexOf("function LabeledInput")
    const newFirm = component.slice(newFirmStart, officeContactStart)
    const officeContact = component.slice(officeContactStart, labeledInputStart)

    for (const [form, fieldIds] of [
      [newFirm, ["contact_first_name", "contact_last_name", "contact_email", "contact_phone", "contact_job_title"]],
      [officeContact, ["office_contact_first_name", "office_contact_last_name", "office_contact_email", "office_contact_phone", "office_contact_job_title"]],
    ] as const) {
      expect(form).toContain('name="contact_first_name"')
      expect(form).toContain('name="contact_last_name"')
      for (const id of fieldIds.slice(0, 2)) {
        const input = labeledInputSource(form, id)
        expect(input).toContain('requirement="conditional"')
        expect(input).toContain('requirementText={CONTACT_NAME_REQUIREMENT_TEXT}')
      }
      expect(form).toContain('name="contact_email"')
      expect(form).toContain('name="contact_phone"')
      expect(form).toContain('name="contact_job_title"')
      for (const id of fieldIds.slice(2))
        expect(labeledInputSource(form, id)).not.toContain("requirement=")
    }
  })

  it("makes existing-contact affiliation and new-person creation mutually exclusive", () => {
    const dialog = contactDialogSource()
    const existingModeStart = dialog.indexOf('{contactMode === "existing" ? (')
    const newModeStart = dialog.indexOf(") : (", existingModeStart)

    expect(dialog).toContain('value="existing"')
    expect(dialog).toContain('value="new"')
    expect(dialog).toContain('aria-labelledby="office_contact_mode_label"')
    expect(dialog).toContain('id="office_contact_mode_label"')
    expect(dialog).toContain("Contact type")
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
    expect(component).toContain("setCanonicalContactOptions([])")
    expect(component).toContain("canonicalContactLookupFailed")
    expect(component).toContain("Retry loading contacts")
    expect(action).toContain(
      "This canonical contact is already affiliated with the selected office.",
    )
  })
})
