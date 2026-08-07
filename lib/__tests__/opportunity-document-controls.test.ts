import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "../..")
const source = fs.readFileSync(path.join(root, "lib/actions/opportunity-documents.ts"), "utf8")
const migration = fs.readFileSync(path.join(root, "scripts/087_opportunity_document_controls.sql"), "utf8")

describe("opportunity document controls", () => {
  it("keeps source teasers explicit, private, PDF-only and retained", () => {
    expect(source).toContain('"source_teaser"')
    expect(source).toContain("PDF_ONLY_DOCUMENT_TYPES")
    expect(source).toContain("STAFF_ONLY_DOCUMENT_TYPES")
    expect(migration).toContain("opportunity_documents_source_teaser_staff_only")
    expect(migration).toContain("opportunity_documents_retain_source_and_im")
  })

  it("does not allow generic approval or deletion of a source teaser or IM", () => {
    expect(source).toContain("granted through the pursuit access workflow")
    expect(source).toContain("cannot be removed. Upload a corrected PDF as a new document")
  })

  it("keeps canonical NDA artifact protection ahead of generic mutations", () => {
    const visibility = source.indexOf("export async function updateOpportunityDocumentVisibility")
    const removal = source.indexOf("export async function removeOpportunityDocument")
    expect(source.indexOf("await assertDocumentIsNotCanonicalNdaArtifact(documentId)", visibility)).toBeGreaterThan(visibility)
    expect(source.indexOf("await assertDocumentIsNotCanonicalNdaArtifact(documentId)", removal)).toBeGreaterThan(removal)
  })
})
