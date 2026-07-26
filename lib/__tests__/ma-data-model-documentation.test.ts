import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()
const contractPath = "docs/data-models/ma-advisory-data-model-v1.md"

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("canonical M&A data model documentation", () => {
  const contract = source(contractPath)

  it("keeps one field-level contract with the required governance metadata", () => {
    expect(contract).toContain("# WAVE M&A Data Model and Dictionary v1")
    expect(contract).toContain("Status | Approved target contract")
    expect(contract).toContain("Last reviewed against live Supabase")
    expect(contract).toContain(
      "Any change to the M&A schema, business validation, visibility rule or import mapping must update this document in the same commit before release.",
    )
  })

  it("retains every core entity and the field dictionary columns", () => {
    for (const heading of [
      "## 1. M&A advisory firm",
      "## 2. Operating office",
      "## 3. Contact",
      "## 4. Contact office affiliation",
      "## 5. Opportunity",
      "## 6. Opportunity contact",
      "## 7. Interaction",
      "## 8. Interaction attachment",
      "## 9. Opportunity document",
    ]) {
      expect(contract).toContain(heading)
    }

    expect(contract).toContain(
      "| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |",
    )
  })

  it("keeps the critical office, validity, visibility and cutover rules explicit", () => {
    for (const rule of [
      "Every non-archived firm has one or more active offices. A firm may have at most one synthetic default office. Once a real active office is known, that default is preserved only for historical attribution and cannot be selected for new or changed opportunity source contexts.",
      "Opportunities and interactions always anchor to an office.",
      "A valid opportunity has at least one active contact and exactly one primary contact.",
      "Source relationships, interactions and internal notes are staff only.",
      "Excel identifiers never remain in live firm, office, contact or opportunity records.",
      "Closed and archived opportunities preserve the source and contact history",
      "The atomic intake service cannot reopen a `closed` or `archived` opportunity.",
      "W-063 integrated-release dependency",
      "A cell containing several email addresses is never imported as one address",
      "WAVE data remains test data until then",
      "scripts/verify-ma-data-model-schema.sql",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("is referenced by both agent operating contracts", () => {
    for (const instructionFile of ["AGENTS.md", "CLAUDE.md"]) {
      const instructions = source(instructionFile)
      expect(instructions).toContain(contractPath)
      expect(instructions).toContain(
        "must update that document in the same commit before release",
      )
    }
  })

  it("keeps the automated change and live-schema guards wired in", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      scripts: Record<string, string>
    }
    const changeGuard = source("scripts/check-ma-data-model-sync.mjs")
    const schemaGuard = source("scripts/verify-ma-data-model-schema.sql")

    expect(packageJson.scripts["data-model:check"]).toContain(
      "check-ma-data-model-sync.mjs",
    )
    expect(packageJson.scripts.lint).toContain("pnpm data-model:check")
    expect(changeGuard).toContain("DATA_MODEL_BASE_REF")
    expect(changeGuard).toContain("change log update required")
    expect(schemaGuard).toContain("information_schema.columns")
    expect(schemaGuard).toContain("pg_constraint")
    expect(schemaGuard).toContain("pg_indexes")
  })
})
