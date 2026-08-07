import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "../..")
const migration = fs.readFileSync(path.join(root, "scripts/087_opportunity_document_controls.sql"), "utf8")
const rehearsal = fs.readFileSync(path.join(root, "scripts/rehearse-opportunity-document-controls.sql"), "utf8")

describe("opportunity document controls migration", () => {
  it("adds the enum value before installing retained-document checks", () => {
    expect(migration.indexOf("ADD VALUE IF NOT EXISTS 'source_teaser'")).toBeLessThan(
      migration.indexOf("opportunity_documents_retained_staff_only"),
    )
    expect(migration).toContain("document_type::TEXT NOT IN ('source_teaser', 'deal_book')")
  })

  it("keeps the rehearsal transaction-safe while testing the existing IM enum member", () => {
    expect(rehearsal).toContain("BEGIN;")
    expect(rehearsal).toContain("\\ir 087_opportunity_document_controls.sql")
    expect(rehearsal).toContain("'deal_book', 'staff_only'")
    expect(rehearsal).toContain("Expected retained-document visibility check to fail")
  })
})
