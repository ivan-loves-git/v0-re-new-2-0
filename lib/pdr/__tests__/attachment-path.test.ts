import { describe, expect, it } from "vitest"
import { isSafePdrAttachmentPath } from "@/lib/pdr/attachment-path"
import { candidateDigest, parseLegacyPdrAttachment } from "../../../scripts/cutover-pdr-legacy-attachments"

describe("PDR private attachment path boundary", () => {
  it("accepts only generated new and legacy namespaces", () => {
    expect(isSafePdrAttachmentPath("123e4567-e89b-42d3-a456-426614174000/report.pdf")).toBe(true)
    expect(isSafePdrAttachmentPath(`legacy/${"a".repeat(64)}-report.pdf`)).toBe(true)
  })
  it("rejects traversal and unowned prefixes", () => {
    expect(isSafePdrAttachmentPath("legacy/../report.pdf")).toBe(false)
    expect(isSafePdrAttachmentPath("other/report.pdf")).toBe(false)
    expect(isSafePdrAttachmentPath("123e4567-e89b-42d3-a456-426614174000/../report.pdf")).toBe(false)
  })
  it("rejects a foreign origin, bucket, and unsafe source path before any copy", () => {
    const origin = "https://pdr.example.test"
    const source = { url: `${origin}/storage/v1/object/public/pdr-attachments/a.pdf`, name: "a.pdf" }
    const candidate = parseLegacyPdrAttachment("proposal", "123e4567-e89b-42d3-a456-426614174000", source, origin)
    expect(candidateDigest([candidate])).toHaveLength(64)
    expect(() => parseLegacyPdrAttachment("proposal", candidate.ownerId, { ...source, url: "https://other.test/storage/v1/object/public/pdr-attachments/a.pdf" }, origin)).toThrow()
    expect(() => parseLegacyPdrAttachment("proposal", candidate.ownerId, { ...source, url: `${origin}/storage/v1/object/public/other/a.pdf` }, origin)).toThrow()
    expect(() => parseLegacyPdrAttachment("proposal", candidate.ownerId, { ...source, url: `${origin}/storage/v1/object/public/pdr-attachments/../a.pdf` }, origin)).toThrow()
  })
})
