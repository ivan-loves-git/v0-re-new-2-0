import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("project document routing", () => {
  const routing = source("docs/project-status.md")

  it("keeps current authority separate from public-safe delivery material, private evidence and archives", () => {
    for (const rule of [
      "The private `re-new-team/renew-governance` repository and its `Re-New Product Delivery` Project own approved product scope",
      "Under Decision #210, Strategic PDR leaves the application",
      "The archive is not a current intake, planning or reporting system",
      "Public-safe delivery communication and release reporting",
      "The existing private Pushapp project repository",
      "legacy source locations, not approval to keep sensitive content public",
      "Retain sent evidence as sent; never rewrite it into an editable draft.",
      "`docs/archive/`, `_archive/`, `.planning/`, `TASKS.md`",
    ]) {
      expect(routing).toContain(rule)
    }
  })

  it("keeps local-only material and repository access changes outside ordinary delivery authority", () => {
    expect(routing).toContain(
      "Do not enumerate, read, relocate, commit or use them as general agent context without separate explicit authority.",
    )
    expect(routing).toContain(
      "other document migrations, GitHub visibility/access changes and local-only boundary changes require their own authority",
    )
    expect(routing).toContain("Actual export and production retirement require the #214 archive and live proof")
    expect(routing).toContain("This file does not establish destination provisioning or archive completeness")
  })
})
