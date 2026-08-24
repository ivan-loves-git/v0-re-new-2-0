import { createHash } from "node:crypto"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { assertPinnedFingerprint, loadFingerprintRehearsalContract } from "@/lib/qa/contract-fingerprint-rehearsal.mjs"

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

async function contractRoot(fingerprint = "a".repeat(64)) {
  const root = await mkdtemp(join(tmpdir(), "renew-qa-fingerprint-"))
  await mkdir(join(root, "supabase/schema"), { recursive: true })
  const paths = ["771_extensions.sql", "qa_control.sql", "permanent_qa_rebuild.sql", "771_public_schema.sql", "772_example.sql"]
  const files = await Promise.all(paths.map(async (name) => {
    const content = "SELECT 1;\n"
    const path = `supabase/schema/${name}`
    await writeFile(join(root, path), content)
    return { path, sha256: sha256(content) }
  }))
  await writeFile(join(root, "supabase/qa-contract.json"), `${JSON.stringify({ version: "test-contract-v1", structureFingerprint: fingerprint, files }, null, 2)}\n`)
  return root
}

describe("QA contract fingerprint rehearsal", () => {
  it("loads only the ordered, hash-verified contract files", async () => {
    const root = await contractRoot()
    const loaded = await loadFingerprintRehearsalContract(root)
    expect(loaded.contract.version).toBe("test-contract-v1")
    expect(loaded.files.map((file) => file.path)).toEqual([
      "supabase/schema/771_extensions.sql",
      "supabase/schema/qa_control.sql",
      "supabase/schema/permanent_qa_rebuild.sql",
      "supabase/schema/771_public_schema.sql",
      "supabase/schema/772_example.sql",
    ])
  })

  it("refuses the all-f sentinel after reporting the calculated value", () => {
    expect(() => assertPinnedFingerprint("f".repeat(64), "a".repeat(64))).toThrow("QA contract fingerprint rehearsal failed: sentinel")
  })

  it("permits the pending sentinel only long enough to calculate and report it", async () => {
    const root = await contractRoot("PENDING_CI_FINGERPRINT")
    await expect(loadFingerprintRehearsalContract(root)).resolves.toBeDefined()
    expect(() => assertPinnedFingerprint("PENDING_CI_FINGERPRINT", "a".repeat(64))).toThrow("QA contract fingerprint rehearsal failed: sentinel")
  })

  it("refuses a listed SQL symlink outside the candidate root", async () => {
    const root = await contractRoot()
    const outside = join(tmpdir(), `renew-qa-outside-${Date.now()}.sql`)
    await writeFile(outside, "SELECT 1;\n")
    const linked = join(root, "supabase/schema/772_example.sql")
    await rm(linked)
    await symlink(outside, linked)
    await writeFile(join(root, "supabase/qa-contract.json"), `${JSON.stringify({
      version: "test-contract-v1",
      structureFingerprint: "a".repeat(64),
      files: [
        { path: "supabase/schema/771_extensions.sql", sha256: sha256("SELECT 1;\n") },
        { path: "supabase/schema/qa_control.sql", sha256: sha256("SELECT 1;\n") },
        { path: "supabase/schema/permanent_qa_rebuild.sql", sha256: sha256("SELECT 1;\n") },
        { path: "supabase/schema/771_public_schema.sql", sha256: sha256("SELECT 1;\n") },
        { path: "supabase/schema/772_example.sql", sha256: sha256("SELECT 1;\n") },
      ],
    }, null, 2)}\n`)
    await expect(loadFingerprintRehearsalContract(root)).rejects.toThrow("QA contract fingerprint rehearsal failed: path")
  })

  it("refuses a computed fingerprint that does not match the pinned contract", () => {
    expect(() => assertPinnedFingerprint("a".repeat(64), "b".repeat(64))).toThrow("QA contract fingerprint rehearsal failed: structure-fingerprint")
  })
})
