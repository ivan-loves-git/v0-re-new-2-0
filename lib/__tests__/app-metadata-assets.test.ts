import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()
const layoutSource = readFileSync(join(repositoryRoot, "app/layout.tsx"), "utf8")

describe("app metadata assets", () => {
  it("advertises only icon files that ship with the application", () => {
    expect(layoutSource).toContain('url: "/icon.svg"')
    expect(layoutSource).toContain('apple: "/apple-icon.png"')
    expect(layoutSource).not.toMatch(/icon-(?:light|dark)-32x32\.png/)
    expect(existsSync(join(repositoryRoot, "public/icon.svg"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "public/apple-icon.png"))).toBe(true)
  })

  it("does not request Vercel Analytics from the runner-hosted QA origin", () => {
    expect(layoutSource).toContain('process.env.QA_EXECUTION_MODE !== "github-runner"')
    expect(layoutSource).toContain("analyticsEnabled ? <Analytics /> : null")
  })
})
