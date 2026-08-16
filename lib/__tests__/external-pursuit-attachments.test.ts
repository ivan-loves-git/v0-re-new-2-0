import { describe, expect, it } from "vitest"
import {
  EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES,
  matchesExpectedFileStructure,
  safeAttachmentFilename,
  validateExternalPursuitAttachment,
} from "@/lib/external-pursuit-attachments"

const encoder = new TextEncoder()
function file(name: string, type: string, body: Uint8Array | string) {
  const part = typeof body === "string" ? body : Uint8Array.from(body).buffer as ArrayBuffer
  return new File([part], name, { type })
}
function le16(value: number) { return [value & 255, (value >>> 8) & 255] }
function le32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255] }
function emptyZip(names: string[]) {
  const local: number[] = []
  const central: number[] = []
  let offset = 0
  for (const name of names) {
    const encoded = [...encoder.encode(name)]
    local.push(
      0x50,0x4b,0x03,0x04, ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(0), ...le32(0), ...le32(0),
      ...le16(encoded.length), ...le16(0), ...encoded,
    )
    central.push(
      0x50,0x4b,0x01,0x02, ...le16(20), ...le16(20), ...le16(0),
      ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(0),
      ...le32(0), ...le16(encoded.length), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...encoded,
    )
    offset = local.length
  }
  return new Uint8Array([...local,...central,0x50,0x4b,0x05,0x06,0,0,0,0,...le16(names.length),...le16(names.length),...le32(central.length),...le32(local.length),0,0])
}

describe("External Pursuit attachment validation", () => {
  it("accepts a structurally valid permitted PDF and rejects prefix-only or active content", () => {
    const body = encoder.encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n")
    const candidate = file("memo.pdf", "application/pdf", body)
    expect(validateExternalPursuitAttachment(candidate)).toBeNull()
    expect(matchesExpectedFileStructure(candidate.name, body)).toBe(true)
    expect(matchesExpectedFileStructure("fake.pdf", encoder.encode("%PDF"))).toBe(false)
    expect(matchesExpectedFileStructure("active.pdf", encoder.encode("%PDF-1.7\n1 0 obj\n<< /JavaScript 2 0 R >>\nendobj\n%%EOF"))).toBe(false)
  })

  it("requires actual OOXML entries and rejects generic or macro-bearing ZIP files", () => {
    expect(matchesExpectedFileStructure("memo.docx", emptyZip(["[Content_Types].xml","_rels/.rels","word/document.xml"]))).toBe(true)
    expect(matchesExpectedFileStructure("sheet.xlsx", emptyZip(["[Content_Types].xml","_rels/.rels","xl/workbook.xml"]))).toBe(true)
    expect(matchesExpectedFileStructure("fake.docx", emptyZip(["notes.txt"]))).toBe(false)
    expect(matchesExpectedFileStructure("macro.docx", emptyZip(["[Content_Types].xml","_rels/.rels","word/document.xml","word/vbaProject.bin"]))).toBe(false)
  })

  it("scans the complete CSV payload for executable, HTML, SVG and NUL content", () => {
    expect(matchesExpectedFileStructure("safe.csv", encoder.encode("name,city\nAda,Paris\n"))).toBe(true)
    expect(matchesExpectedFileStructure("page.csv", encoder.encode("name,value\nA,1\n<svg onload=x>"))).toBe(false)
    expect(matchesExpectedFileStructure("binary.csv", new Uint8Array([65,44,66,0,67]))).toBe(false)
    expect(matchesExpectedFileStructure("archive.csv", emptyZip(["payload.exe"]))).toBe(false)
  })

  it("rejects mismatched MIME, archives and unsafe names and enforces 20 MiB", () => {
    expect(validateExternalPursuitAttachment(file("memo.pdf", "text/html", "x"))).toMatch(/type/i)
    expect(validateExternalPursuitAttachment(file("archive.zip", "application/zip", "x"))).toMatch(/permitted/i)
    expect(safeAttachmentFilename('x/evil\"\n.pdf')).toBe("x_evil_.pdf")
    const tooLarge = new File([new Uint8Array(EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES + 1)], "large.pdf", { type: "application/pdf" })
    expect(validateExternalPursuitAttachment(tooLarge)).toMatch(/20 MiB/)
  })
})
