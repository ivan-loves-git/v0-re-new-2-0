import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  `${process.cwd()}/components/forms/validation-feedback.tsx`,
  "utf8",
)

describe("staff form validation feedback contract", () => {
  it("explains required, optional, and conditional fields in words", () => {
    expect(source).toContain('type Requirement = "required" | "optional" | "conditional"')
    expect(source).toContain('"Required"')
    expect(source).toContain('"Optional"')
    expect(source).toContain('"Required for this step"')
  })

  it("binds named field errors accessibly and never relies on colour alone", () => {
    expect(source).toContain('role="alert"')
    expect(source).toContain('"aria-invalid": Boolean(message)')
    expect(source).toContain('"aria-describedby"')
    expect(source).toContain('<CircleAlert')
  })

  it("provides a focusable linked summary for invalid Save or Next attempts", () => {
    expect(source).toContain('tabIndex={-1}')
    expect(source).toContain('href={`#${field}`}')
    expect(source).toContain('requestAnimationFrame')
  })
})
