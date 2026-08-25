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
