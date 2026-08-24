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
    expect(contract).toContain("Status | Approved and live contract")
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
      "Source relationships, interactions, audit metadata and internal notes are staff only, except for the tightly gated source-identity disclosure",
      "Excel identifiers never remain in live firm, office, contact or opportunity records.",
      "Closed and archived opportunities preserve the source and contact history",
      "The atomic intake service cannot reopen a `closed` or `archived` opportunity.",
      "Canonical firm intake serializes on the lower-trimmed name",
      "W-063 staff intake reconciliation",
      "A cell containing several email addresses is never imported as one address",
      "After the switch, WAVE owns every correction and future activity; the workbook is read-only evidence.",
      "scripts/verify-ma-data-model-schema.sql",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("keeps Colin's post-cutover answers bounded to canonical reconciliation and purpose-aware suppression", () => {
    for (const rule of [
      "WAVE persists its canonical sector label and geography-node identity, not the workbook code.",
      "Exactly one recognized code that resolves to exactly one approved mapping produces a `confirmed` reconciliation outcome",
      "A blank, malformed, multiple, unknown or non-resolving code produces `review`",
      "The workbook's 12 qualified values `ZZZ (EDUCATION-FORMATION)` and `ZZZ (PRODUITS DE CONSOMMATION ET SERVICES)`",
      "only in the staff-only per-row reconciliation evidence",
      "do not write `activity` or persist a second taxonomy",
      "`BFC` is an accepted source compatibility alias of canonical `BFR`",
      "109 blank source title cells and the 20 live newly created Draft/staff-only title gaps",
      "A later WAVE edit always wins over stale workbook evidence.",
      "Campaign suppression belongs to the canonical person and applies across all office affiliations.",
      "At W-072 launch, the operational allowlist contains exactly one purpose",
      "Adding any other operational purpose requires a separately approved PDR decision",
      "Free-text purpose and a generic bypass are not valid authorization.",
      "Exactly the 18 named W-010 contacts with retained source evidence receive structured campaign suppression",
      "No real contact receives a test message.",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("keeps the complete E4 to E8 sequence distinct and evidence-gated", () => {
    for (const rule of [
      "## Lifecycle action and evidence authority matrix",
      "E4 fires once for each distinct mutual-interest-validation event",
      "A retry of the same validation event deduplicates",
      "A later distinct validation creates its own E4 and qualification request",
      "the opportunity-level blank NDA only if absent at that later event",
      "the intermediary qualification for that repreneur is validated",
      "| E6 — repreneur NDA-ready notice |",
      "E6 does not create or validate either pursuit-specific signed copy",
      "| Re-New-signed pursuit copy |",
      "| Repreneur-signed pursuit copy |",
      "Gate 2 requires two validated pursuit-specific signed copies",
      "an already recorded `Gate 2 passed` event remains valid",
      "E7 sends to the intermediary, transmits or references both signed pursuit copies, and requests the information memo",
      "E8 requires both a passed staff Gate 2 and an actual approved memo; neither condition alone may fire E8",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("requires a validated two-party mutual-interest event before E4", () => {
    for (const rule of [
      "Repreneur records their own response",
      "staff records and validates the intermediary/counterparty response with reliable evidence",
      "Only the validated response pair creates a distinct mutual-interest-validation immutable event; only that event may trigger E4",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("keeps the source-disclosure conjunction and revocation explicit", () => {
    for (const rule of [
      "both pursuit-specific signed copies remain valid",
      "a recorded Gate 2 pass",
      "an explicit staff disclosure approval",
      "access is revoked on NDA expiry, staff revocation or pursuit closure",
      "Source-review metadata, correction evidence, audit metadata and M&A relationship history are always staff-only",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("keeps Acme storage and correction retention on canonical evidence", () => {
    for (const rule of [
      "existing canonical `source_office_id` link to Acme's office",
      "“Source review required” is computed, never stored as a parallel review status",
      "retain it after later resolution",
      "retains the Acme assignment and reason in immutable correction evidence",
      "if none exists, add an additive migration before that implementation release",
      "Acme is never renamed into an actual intermediary",
      "an Acme-linked opportunity cannot close",
      "an Acme-linked opportunity cannot archive",
      "Acme exception remains a blocker",
      "W-001 requires no data migration",
      "W-001 has no standalone roadmap entry",
    ]) {
      expect(contract).toContain(rule)
    }
  })

  it("links the authority and disclosure cards from the canonical scope", () => {
    expect(contract).toContain(
      "PDR scope | W-001, repreneur action and staff-verified transition authority; W-021, conditional source-identity disclosure",
    )
  })

  it("distinguishes opportunity and pursuit closure authority", () => {
    expect(contract).toContain("| Close opportunity |")
    expect(contract).toContain("| Close pursuit |")
    expect(contract).toContain("an unresolved Acme source does not block this action")
    expect(contract).toContain("closure immediately revokes any source-identity disclosure")
  })

  it("does not restore superseded absolute visibility or projection policy", () => {
    expect(contract).not.toContain(
      "Source firm, source office, source contacts, relationship history and internal notes remain staff only at every stage.",
    )
    expect(contract).not.toContain(
      "Repreneur projections continue to exclude firm, office, contact and affiliation data.",
    )
  })

  it("is referenced by the canonical agent operating contract", () => {
    const instructions = source("AGENTS.md")
    expect(instructions).toContain(contractPath)
    expect(instructions).toContain(
      "must update that document in the same commit before release",
    )
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
    expect(changeGuard).toContain("DATA_MODEL_BASE_REF")
    expect(changeGuard).toContain("change log update required")
    expect(schemaGuard).toContain("information_schema.columns")
    expect(schemaGuard).toContain("pg_constraint")
    expect(schemaGuard).toContain("pg_indexes")
  })
})
