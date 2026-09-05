import { describe, expect, it } from "vitest"
import { assertExactPursuitAttachments } from "@/lib/pursuit-handoff-attachments"
import { createHash } from "node:crypto"

const copy = (id: string, bytes = new Uint8Array(Buffer.from("%PDF-1.4 synthetic"))) => ({ artifactId: id, bytes, contentSha256: createHash("sha256").update(bytes).digest("hex"), fileName: `${id}.pdf`, mimeType: "application/pdf" })
describe("pursuit E7 attachments", () => {
  it("requires exactly two hash-verified PDFs and records only a safe snapshot", () => {
    expect(assertExactPursuitAttachments([copy("a"), copy("b")]).snapshot).toEqual(expect.arrayContaining([expect.objectContaining({ artifact_id: "a" })]))
    expect(() => assertExactPursuitAttachments([copy("a")])).toThrow("exactly")
    expect(() => assertExactPursuitAttachments([{ ...copy("a"), contentSha256: "0".repeat(64) }, copy("b")])).toThrow("matches")
  })
})
