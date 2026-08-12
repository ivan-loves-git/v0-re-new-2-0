import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("project document routing", () => {
  const routing = source("docs/project-status.md")

  it("keeps current authority separate from communications, sent evidence and archives", () => {
    for (const rule of [
      "The PDR is the only current source for goals, cards, decisions, owners and delivery status.",
      "`docs/communications/` and `docs/reports/`",
      "`docs/emails-sent/`",
      "Retain as sent evidence. Do not rewrite it into an editable draft",
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
      "A document move, rename, deletion, GitHub visibility or access change, or any change to a local-only boundary requires a separate explicit decision from Ivan",
    )
    expect(routing).toContain("None is approved by this routing policy.")
  })
})
