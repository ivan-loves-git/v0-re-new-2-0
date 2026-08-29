import { describe, expect, it } from "vitest"
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  createW163PrivateDryRunReceipt,
  reconcileReviewedPlatformTitles,
  validateW163PrivateDryRunReceipt,
} from "@/lib/w163-title-reconciliation"

const parserPath = path.resolve("scripts/parse-w163-platform-title-workbook.py")
const fixtureWriter = String.raw`
import html, json, sys, zipfile
from pathlib import Path

output = Path(sys.argv[1])
options = json.loads(sys.argv[2])
headers = options.get("headers", ["Ref. Mandat", "Titre sur plateforme"])
reference_count = options.get("referenceCount", 150)
target_count = options.get("targetCount", 39)
sheet_name = options.get("sheetName", "Opportunités")
sheet_count = options.get("sheetCount", 1)

def cell(column, row, value):
    return f'<c r="{column}{row}" t="inlineStr"><is><t>{html.escape(value)}</t></is></c>'

rows = [f'<row r="1">{"".join(cell(chr(65 + index), 1, value) for index, value in enumerate(headers))}</row>']
for index in range(reference_count):
    reference = f"REF-{index:03d}"
    if options.get("duplicateReference") and index == 1:
        reference = "REF-000"
    values = {"Ref. Mandat": reference}
    if index < target_count:
        title = f"Reviewed title {index:03d}"
        if options.get("duplicateTitle") and index == 1:
            title = "Reviewed title 000"
        values["Titre sur plateforme"] = title
    row_cells = "".join(cell(chr(65 + column), index + 2, values[header]) for column, header in enumerate(headers) if header in values)
    rows.append(f'<row r="{index + 2}">{row_cells}</row>')

sheet_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + "".join(rows) + "</sheetData></worksheet>"
sheets = "".join(f'<sheet name="{html.escape(sheet_name if index == 0 else "Extra")}" sheetId="{index + 1}" r:id="rId{index + 1}"/>' for index in range(sheet_count))
relationships = "".join(f'<Relationship Id="rId{index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index + 1}.xml"/>' for index in range(sheet_count))
workbook_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets + "</sheets></workbook>"
rels_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + relationships + "</Relationships>"
with zipfile.ZipFile(output, "w") as archive:
    archive.writestr("xl/workbook.xml", workbook_xml)
    archive.writestr("xl/_rels/workbook.xml.rels", rels_xml)
    archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
`

function withWorkbookFixture(
  options: Record<string, unknown>,
  assertion: (workbookPath: string) => void,
) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "w163-parser-"))
  const workbookPath = path.join(directory, "fixture.xlsx")
  try {
    execFileSync("python3", ["-c", fixtureWriter, workbookPath, JSON.stringify(options)], { stdio: "pipe" })
    assertion(workbookPath)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function withPrivateOutput(assertion: (outputPath: string, directory: string) => void) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "w163-parser-output-"))
  const outputPath = path.join(directory, "reviewed-titles.json")
  try {
    assertion(outputPath, directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
  return directory
}

function runParserCli(workbookPath: string, outputPath: string) {
  return spawnSync("python3", [parserPath, workbookPath, "--private-output", outputPath], { encoding: "utf8" })
}

function runParserModule(workbookPath: string) {

  const runner = String.raw`
import hashlib, importlib.util, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("w163_parser", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.EXPECTED_SHA256 = hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest()
module.parse(Path(sys.argv[2]))
`
  return spawnSync("python3", ["-c", runner, parserPath, workbookPath], { encoding: "utf8" })
}

describe("W-163 platform-title reconciliation", () => {
  it("rejects any workbook whose digest differs from Colin's approved source", () => {
    withWorkbookFixture({}, (workbookPath) => {
      withPrivateOutput((outputPath) => {
        const result = runParserCli(workbookPath, outputPath)
        expect(result.status).toBe(1)
        expect(result.stdout).toBe("")
        expect(result.stderr).toContain("SHA-256")
        expect(existsSync(outputPath)).toBe(false)
      })
    })
  })

  it.each([
    ["wrong sheet", { sheetName: "Wrong" }],
    ["multiple sheets", { sheetCount: 2 }],
    ["missing required header", { headers: ["Ref. Mandat"] }],
    ["duplicate required header", { headers: ["Ref. Mandat", "Titre sur plateforme", "Titre sur plateforme"] }],
    ["duplicate source reference", { duplicateReference: true }],
    ["duplicate reviewed title", { duplicateTitle: true }],
    ["wrong reference shape", { referenceCount: 149 }],
    ["wrong reviewed-target shape", { targetCount: 38 }],
  ])("rejects a %s workbook shape after digest pinning", (_name, options) => {
    withWorkbookFixture(options, (workbookPath) => {
      const result = runParserModule(workbookPath)
      expect(result.status).not.toBe(0)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("W-163 workbook validation failed")
    })
  })

  it.runIf(existsSync("/tmp/w163-doc-titles.xlsx"))("uses a private 0600 handoff for the approved workbook and prints no mappings", () => {
    const removedDirectory = withPrivateOutput((outputPath) => {
      const result = runParserCli("/tmp/w163-doc-titles.xlsx", outputPath)
      expect(result.status).toBe(0)
      expect(result.stdout).toBe("")
      expect(result.stderr).toBe("")
      expect(statSync(outputPath).mode & 0o777).toBe(0o600)
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toHaveLength(39)
    })
    expect(existsSync(removedDirectory)).toBe(false)
  })

  it("creates only compare-and-set title updates and preserves a matching current title", () => {
    const result = reconcileReviewedPlatformTitles(
      [
        { reference: "REF-001", publicTitle: "Reviewed title" },
        { reference: "REF-002", publicTitle: "Unchanged title" },
      ],
      [
        { id: "one", reference: "REF-001", publicTitle: "Previous title", isDemo: false },
        { id: "two", reference: "REF-002", publicTitle: "Unchanged title", isDemo: false },
      ],
    )

    expect(result.summary).toEqual({ noOps: 1, guardedUpdates: 1, blockers: 0, conflicts: 0 })
    expect(result.outcomes).toContainEqual({
      kind: "guarded_update",
      id: "one",
      reference: "REF-001",
      expectedPublicTitle: "Previous title",
      nextPublicTitle: "Reviewed title",
    })
  })

  it("fails closed for missing, duplicate, and DEMO references", () => {
    const result = reconcileReviewedPlatformTitles(
      [
        { reference: "MISSING", publicTitle: "Reviewed" },
        { reference: "DUPLICATE", publicTitle: "Reviewed" },
        { reference: "DEMO", publicTitle: "Reviewed" },
      ],
      [
        { id: "one", reference: "DUPLICATE", publicTitle: "A", isDemo: false },
        { id: "two", reference: "DUPLICATE", publicTitle: "B", isDemo: false },
        { id: "three", reference: "DEMO", publicTitle: "A", isDemo: true },
      ],
    )

    expect(result.summary).toEqual({ noOps: 0, guardedUpdates: 0, blockers: 2, conflicts: 1 })
  })

  it("accounts for the approved 17 no-op / 22 guarded-update shape without exposing source titles", () => {
    const reviewed = Array.from({ length: 39 }, (_, index) => ({
      reference: `REF-${index}`,
      publicTitle: `reviewed-${index}`,
    }))
    const current = reviewed.map((item, index) => ({
      id: `id-${index}`,
      reference: item.reference,
      publicTitle: index < 17 ? item.publicTitle : `previous-${index}`,
      isDemo: false,
    }))

    expect(reconcileReviewedPlatformTitles(reviewed, current).summary).toEqual({
      noOps: 17,
      guardedUpdates: 22,
      blockers: 0,
      conflicts: 0,
    })
  })

  it("creates a deterministic aggregate-only receipt for the exact resolved state", () => {
    const reviewed = [{ reference: "REF-001", publicTitle: "Reviewed title" }]
    const current = [{ id: "one", reference: "REF-001", publicTitle: "Previous title", isDemo: false }]

    const first = createW163PrivateDryRunReceipt("source-digest", reviewed, current)
    const second = createW163PrivateDryRunReceipt("source-digest", [...reviewed], [...current])

    expect(first).toEqual(second)
    expect(first.aggregate).toEqual({ reviewedTargets: 1, noOps: 0, guardedUpdates: 1, blockers: 0, conflicts: 0 })
    expect(first.stateFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(first)).not.toContain("REF-001")
    expect(JSON.stringify(first)).not.toContain("Reviewed title")
    expect(JSON.stringify(first)).not.toContain("one")
  })

  it("requires an untouched receipt before an apply can proceed", () => {
    const reviewed = [{ reference: "REF-001", publicTitle: "Reviewed title" }]
    const current = [{ id: "one", reference: "REF-001", publicTitle: "Previous title", isDemo: false }]
    const receipt = createW163PrivateDryRunReceipt("source-digest", reviewed, current)

    expect(() => validateW163PrivateDryRunReceipt(undefined, receipt)).toThrow("receipt is required")
    expect(() => validateW163PrivateDryRunReceipt({ ...receipt, sourceDigest: "tampered" }, receipt)).toThrow("source digest")
    expect(() => validateW163PrivateDryRunReceipt({ ...receipt, aggregate: { ...receipt.aggregate, guardedUpdates: 2 } }, receipt)).toThrow("aggregate")
  })

  it.each([
    ["title", [{ id: "one", reference: "REF-001", publicTitle: "Changed title", isDemo: false }]],
    ["reference", [{ id: "one", reference: "REF-002", publicTitle: "Previous title", isDemo: false }]],
    ["id", [{ id: "two", reference: "REF-001", publicTitle: "Previous title", isDemo: false }]],
    ["DEMO classification", [{ id: "one", reference: "REF-001", publicTitle: "Previous title", isDemo: true }]],
  ])("rejects receipt replay when %s drifts between dry run and apply", (_kind, driftedCurrent) => {
    const reviewed = [{ reference: "REF-001", publicTitle: "Reviewed title" }]
    const receipt = createW163PrivateDryRunReceipt("source-digest", reviewed, [
      { id: "one", reference: "REF-001", publicTitle: "Previous title", isDemo: false },
    ])
    const afterDrift = createW163PrivateDryRunReceipt("source-digest", reviewed, driftedCurrent)

    expect(() => validateW163PrivateDryRunReceipt(receipt, afterDrift)).toThrow(/fingerprint|aggregate/)
  })

  it("uses a DEMO-safe compare-and-set UPDATE that names no writable field except public_title", () => {
    const operator = readFileSync("scripts/reconcile-w163-platform-titles.ts", "utf8")
    expect(operator).toContain("UPDATE public.opportunities SET public_title = $1")
    expect(operator).toContain("reference = $3")
    expect(operator).toContain("is_demo = false")
    expect(operator).toContain("public_title IS NOT DISTINCT FROM $4")
    expect(operator).not.toContain("SET status")
    expect(operator).not.toContain("SET repreneur_exposure")
  })

  it("requires an external private receipt for both dry-run and apply, then validates it before updates", () => {
    const operator = readFileSync("scripts/reconcile-w163-platform-titles.ts", "utf8")
    expect(operator).toContain('assertPrivateExternalPath(receiptPath, "--receipt")')
    expect(operator).toContain("flag: \"wx\"")
    expect(operator.indexOf("validateW163PrivateDryRunReceipt")).toBeLessThan(
      operator.indexOf("UPDATE public.opportunities SET public_title = $1"),
    )
  })

  it("removes the operator's private workbook handoff in a finally block", () => {
    const operator = readFileSync("scripts/reconcile-w163-platform-titles.ts", "utf8")
    expect(operator).toContain('mkdtempSync(path.join(os.tmpdir(), "w163-title-handoff-"))')
    expect(operator).toContain("finally {\n    rmSync(privateHandoffDirectory, { recursive: true, force: true })")
  })

  it("keeps the decision-first staff scan order while retaining public-title search", () => {
    const surface = readFileSync("components/opportunities/opportunity-work-surface-table.tsx", "utf8")
    expect(surface).toContain('searchPlaceholder="Search opportunities..."')
    expect(surface).toContain("opportunity.public_title,")
    expect(surface).toContain("<TableHead>Title</TableHead>")
    expect(surface).toContain("<TableHead>Region</TableHead>")
    expect(surface).toContain("<TableHead>Revenue</TableHead>")
    expect(surface).toContain("<TableHead>EBITDA</TableHead>")
    expect(surface.indexOf("<TableHead>Title</TableHead>")).toBeLessThan(
      surface.indexOf("<TableHead>Region</TableHead>"),
    )
  })
})
