import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { assertSafePdfEvidence } from "@/lib/security/pdf-evidence"
import { syntheticPdfBytes } from "@/lib/__tests__/fixtures/synthetic-pdf"

describe("W-152 PDF evidence validation", () => {
  it("accepts a structurally parsed inert PDF", async () => {
    await expect(assertSafePdfEvidence(syntheticPdfBytes())).resolves.toBeUndefined()
  })

  it("accepts a structurally valid PDF at the exact 20 MiB boundary", async () => {
    const base = syntheticPdfBytes()
    const exactBoundary = new Uint8Array(20 * 1024 * 1024)
    exactBoundary.fill(0x20)
    exactBoundary.set(base)

    await expect(assertSafePdfEvidence(exactBoundary)).resolves.toBeUndefined()
  }, 20_000)

  it("rejects a document whose declared page count exceeds the parser bound", async () => {
    await expect(assertSafePdfEvidence(syntheticPdfBytes(501))).rejects.toThrow(
      "unsupported page count",
    )
  })

  it.each([
    ["wrong signature", new TextEncoder().encode("not a PDF")],
    ["malformed structure", new TextEncoder().encode("%PDF-1.4\n%%EOF\n")],
    [
      "active JavaScript",
      new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF\n",
      ),
    ],
    [
      "embedded payload",
      new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj << /Type /EmbeddedFile >> endobj\n%%EOF\n",
      ),
    ],
    [
      "polyglot trailer",
      new Uint8Array(Buffer.concat([Buffer.from(syntheticPdfBytes()), Buffer.from("<script>payload</script>")])),
    ],
  ])("rejects %s before evidence persistence", async (_name, bytes) => {
    await expect(assertSafePdfEvidence(bytes)).rejects.toThrow(/NDA evidence|PDF/)
  })

  it("keeps validation before both approved Storage upload paths", () => {
    for (const relativePath of [
      "lib/actions/opportunity-nda-artifacts.ts",
      "lib/actions/portal-pursuit-nda.ts",
    ]) {
      const source = readFileSync(`${process.cwd()}/${relativePath}`, "utf8")
      expect(source.indexOf("await assertSafePdfEvidence")).toBeGreaterThanOrEqual(0)
      expect(source.indexOf("await assertSafePdfEvidence")).toBeLessThan(
        source.indexOf(".storage"),
      )
    }
    expect(
      readFileSync(
        `${process.cwd()}/lib/actions/opportunity-nda-artifacts.ts`,
        "utf8",
      ),
    ).toContain("file.type !== expectedMimeType")
    expect(
      readFileSync(
        `${process.cwd()}/lib/actions/portal-pursuit-nda.ts`,
        "utf8",
      ),
    ).toContain('file.type !== "application/pdf"')
  })
})
