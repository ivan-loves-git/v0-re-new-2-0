import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

describe("shared document-row vocabulary", () => {
  it("keeps View and Download as separate permitted actions", () => {
    const actions = source("components/opportunities/document-row-actions.tsx")

    expect(actions).toContain("<Eye className")
    expect(actions).toContain("            View")
    expect(actions).toContain("            Download")
    expect(actions).not.toContain("View or download")
  })

  it("maps CV and lettre de cadrage onto the shared mutable interaction policy", () => {
    const card = source("components/repreneurs/documents-card.tsx")

    expect(card).toContain("CV_LDC_DOCUMENT_POLICY")
    expect(card).toContain("<DocumentRowActions")
    expect(card).toContain("canReplace: true")
    expect(card).toContain("canRemove: true")
    expect(card).toContain("downloadHref={currentUrl ? `${documentUrl}?download` : undefined}")
  })

  it("keeps canonical NDA history locked and does not offer overwrite or removal", () => {
    const manager = source("components/opportunities/opportunity-nda-artifact-manager.tsx")

    expect(manager).toContain('state="locked"')
    expect(manager).toContain('getOpportunityDocumentPolicy("nda", true)')
    expect(manager).toContain('definition.role !== "repreneur_signed_copy"')
  })
})
