import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

describe("retired PDR operator commands", () => {
  it.each([
    "governance:refresh",
    "pdr:screening:rehearse",
    "pdr:reconcile-history",
    "pdr:cutover-legacy-attachments",
    "pdr:grant-ivan-capability",
    "pdr:purge-legacy-storage-cache",
    "pdr:verify-final-retirement",
  ])("fails closed without credentials at %s", (alias) => {
    const result = spawnSync("pnpm", [alias], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15_000,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test" },
    })
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/Retired PDR/)
  })
})
