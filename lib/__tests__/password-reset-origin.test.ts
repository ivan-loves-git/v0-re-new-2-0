import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(process.cwd(), "lib/auth.ts"), "utf8")
describe("W-151 password-reset origin boundary", () => {
  it("uses an explicit Re-New origin allowlist and never trusts request headers or shared suffixes", () => {
    expect(source).toContain('return [env.BETTER_AUTH_URL, "https://app.re-new.team"]')
    expect(source).not.toMatch(/endsWith\(.*(?:vercel|v0)/)
    expect(source).not.toContain('headers?.get("origin")')
  })
})
