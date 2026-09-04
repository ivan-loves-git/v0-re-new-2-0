import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("PDR screening editor", () => {
  it("explains the zero-question bug path instead of rendering an empty clarification form", () => {
    const source = readFileSync(resolve(process.cwd(), "components/strategic-pdr/pdr-screening-editor.tsx"), "utf8")
    expect(source).toContain('preview.draft.classification === "bug"')
    expect(source).toContain("No further clarification is needed for this bug report")
  })
})
