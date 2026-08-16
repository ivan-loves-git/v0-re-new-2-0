import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES,
  safeAttachmentFilename,
  validateExternalPursuitAttachment,
} from "@/lib/external-pursuit-attachments"
import { matchesExpectedFileStructure } from "@/lib/security/external-pursuit-attachment-content"

const encoder = new TextEncoder()
function file(name: string, type: string, body: Uint8Array | string) {
  const part = typeof body === "string" ? body : Uint8Array.from(body).buffer as ArrayBuffer
  return new File([part], name, { type })
}
function le16(value: number) { return [value & 255, (value >>> 8) & 255] }
function le32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255] }
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function storedZip(entries: Record<string, string>) {
  const local: number[] = []
  const central: number[] = []
  for (const [name, value] of Object.entries(entries)) {
    const encodedName = [...encoder.encode(name)]
    const content = encoder.encode(value)
    const offset = local.length
    const crc = crc32(content)
    local.push(0x50,0x4b,0x03,0x04,...le16(20),...le16(0),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(content.length),...le32(content.length),...le16(encodedName.length),...le16(0),...encodedName,...content)
    central.push(0x50,0x4b,0x01,0x02,...le16(20),...le16(20),...le16(0),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(content.length),...le32(content.length),...le16(encodedName.length),...le16(0),...le16(0),...le16(0),...le16(0),...le32(0),...le32(offset),...encodedName)
  }
  return new Uint8Array([...local,...central,0x50,0x4b,0x05,0x06,0,0,0,0,...le16(Object.keys(entries).length),...le16(Object.keys(entries).length),...le32(central.length),...le32(local.length),0,0])
}
function validDocx() {
  return storedZip({
    "[Content_Types].xml": '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<Relationships><Relationship Target="word/document.xml"/></Relationships>',
    "word/document.xml": '<w:document xmlns:w="urn:test"><w:body/></w:document>',
  })
}
function validXlsx() {
  return storedZip({
    "[Content_Types].xml": '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    "_rels/.rels": '<Relationships><Relationship Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="urn:test"/>',
  })
}
function validPdf(extra = "") {
  const header = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog ${extra} >>\nendobj\n`
  const xrefOffset = header.length
  return encoder.encode(`${header}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)
}

describe("External Pursuit attachment validation", () => {
  it("accepts a complete passive PDF and rejects OpenAction and polyglot fixtures", () => {
    expect(matchesExpectedFileStructure("memo.pdf", validPdf())).toBe(true)
    expect(matchesExpectedFileStructure("active.pdf", validPdf("/OpenAction 2 0 R"))).toBe(false)
    expect(matchesExpectedFileStructure("escaped-active.pdf", validPdf("/Open#41ction 2 0 R /Java#53cript 3 0 R"))).toBe(false)
    const polyglot = validPdf("/Comment (PK\u0003\u0004 payload)")
    expect(matchesExpectedFileStructure("polyglot.pdf", polyglot)).toBe(false)
  })

  it("parses real OOXML package contents instead of trusting required filenames", () => {
    expect(matchesExpectedFileStructure("memo.docx", validDocx())).toBe(true)
    expect(matchesExpectedFileStructure("sheet.xlsx", validXlsx())).toBe(true)
    expect(matchesExpectedFileStructure("fake.docx", storedZip({ "[Content_Types].xml":"", "_rels/.rels":"", "word/document.xml":"" }))).toBe(false)
    expect(matchesExpectedFileStructure("macro.docx", storedZip({ "[Content_Types].xml":"<Types/>", "_rels/.rels":"<Relationships/>", "word/document.xml":"<w:document/>", "word/vbaProject.bin":"x" }))).toBe(false)
    expect(matchesExpectedFileStructure("nested-archive.docx", storedZip({
      "[Content_Types].xml": '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      "_rels/.rels": '<Relationships><Relationship Target="word/document.xml"/></Relationships>',
      "word/document.xml": '<w:document xmlns:w="urn:test"><w:body/></w:document>',
      "word/media/payload.dat": "PK\u0003\u0004nested archive",
    }))).toBe(false)
    expect(matchesExpectedFileStructure("named-archive.xlsx", storedZip({
      "[Content_Types].xml": '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
      "_rels/.rels": '<Relationships><Relationship Target="xl/workbook.xml"/></Relationships>',
      "xl/workbook.xml": '<workbook xmlns="urn:test"/>',
      "xl/media/payload.7z": "payload",
    }))).toBe(false)
  })

  it("scans the complete CSV payload for executable and HTML event content", () => {
    expect(matchesExpectedFileStructure("safe.csv", encoder.encode("name,city\nAda,Paris\n"))).toBe(true)
    expect(matchesExpectedFileStructure("page.csv", encoder.encode("name,value\nA,1\n<body onload=alert(1)>"))).toBe(false)
    expect(matchesExpectedFileStructure("event.csv", encoder.encode("name,value\nA,onload=alert(1)"))).toBe(false)
    expect(matchesExpectedFileStructure("formula.csv", encoder.encode("name,value\nA,=HYPERLINK(\"https://example.test\")"))).toBe(false)
    expect(matchesExpectedFileStructure("quoted-formula.csv", encoder.encode("name;value\nA;\"  @SUM(1,2)\""))).toBe(false)
    expect(matchesExpectedFileStructure("tab-formula.csv", encoder.encode("name\tvalue\nA\t+CMD"))).toBe(false)
    expect(matchesExpectedFileStructure("binary.csv", new Uint8Array([65,44,66,0,67]))).toBe(false)
  })

  it("rejects fake image and legacy CFB fixtures plus extension/MIME mismatches", () => {
    expect(matchesExpectedFileStructure("avatar.jpg", new Uint8Array(readFileSync(join(process.cwd(), "public/avatars/default-10.jpg"))))).toBe(true)
    const onePixelPng = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"))
    expect(matchesExpectedFileStructure("pixel.png", onePixelPng)).toBe(true)
    const fakePng = new Uint8Array(33)
    fakePng.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
    expect(matchesExpectedFileStructure("fake.png", fakePng)).toBe(false)
    const headerOnlyWebp = new Uint8Array(30)
    headerOnlyWebp.set(encoder.encode("RIFF"), 0)
    headerOnlyWebp.set(le32(22), 4)
    headerOnlyWebp.set(encoder.encode("WEBPVP8X"), 8)
    headerOnlyWebp.set(le32(10), 16)
    expect(matchesExpectedFileStructure("fake.webp", headerOnlyWebp)).toBe(false)
    const syntheticJpeg = new Uint8Array([
      0xff,0xd8,
      0xff,0xe0,0x00,0x10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      0xff,0xc0,0x00,0x08,0x08,0x00,0x01,0x00,0x01,0x01,
      0xff,0xda,0x00,0x02,
      0xff,0xd9,
    ])
    expect(matchesExpectedFileStructure("fake.jpg", syntheticJpeg)).toBe(false)
    const fakeCfb = new Uint8Array(128)
    fakeCfb.set([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])
    fakeCfb.set(encoder.encode("WordDocument"), 32)
    expect(matchesExpectedFileStructure("fake.doc", fakeCfb)).toBe(false)
    expect(validateExternalPursuitAttachment(file("legacy.doc", "application/msword", fakeCfb))).toMatch(/permitted/i)
    expect(validateExternalPursuitAttachment(file("memo.pdf", "text/html", "x"))).toMatch(/type/i)
  })

  it("bounds file size and sanitizes display names", () => {
    expect(safeAttachmentFilename('x/evil\"\n.pdf')).toBe("x_evil_.pdf")
    const tooLarge = new File([new Uint8Array(EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES + 1)], "large.pdf", { type: "application/pdf" })
    expect(validateExternalPursuitAttachment(tooLarge)).toMatch(/20 MiB/)
  })
})
