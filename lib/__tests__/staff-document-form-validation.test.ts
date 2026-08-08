import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const readComponent = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

describe("staff document form validation", () => {
  it("gives generic opportunity documents a custom, linked validation path", () => {
    const source = readComponent("components/opportunities/opportunity-documents-panel.tsx")

    expect(source).toContain("<ValidationSummary")
    expect(source).toContain("noValidate action={handleSubmit}")
    expect(source).toContain('errors["document-title"]')
    expect(source).toContain('errors["document-file"]')
    expect(source).toContain('fieldErrorProps("document-file"')
  })

  it("keeps the NDA file policy explicit while showing accessible errors", () => {
    const source = readComponent("components/opportunities/opportunity-nda-artifact-manager.tsx")

    expect(source).toContain('acceptedFileLabel: "PDF or DOCX file"')
    expect(source).toContain('acceptedFileLabel: "PDF file"')
    expect(source).toContain("<ValidationSummary")
    expect(source).toContain("noValidate")
    expect(source).toContain("fieldErrorProps(`${definition.role}-file`")
  })

  it("lets staff request M&A follow-up and explains every missing send field", () => {
    const source = readComponent("components/opportunities/opportunity-ma-workflow-panel.tsx")

    expect(source).toContain("<form noValidate onSubmit={handleSend}")
    expect(source).toContain("errors.ma_recipient")
    expect(source).toContain("errors.ma_subject")
    expect(source).toContain("errors.ma_body")
    expect(source).toContain("<ValidationSummary")
  })
})
