import { afterEach, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const roots: string[] = []
const entrypoints = ["AGENTS.md", "CLAUDE.md", "START-HERE.md", "docs/TESTING_RELEASE_PROTOCOL.md"]
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "renew-instructions-"))
  roots.push(root)
  for (const file of entrypoints) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), "Read the canonical routing adapter. Ivan selects the next stage.\n")
  }
  return root
}
function check(root: string) {
  return spawnSync(process.execPath, [resolve("scripts/check-agent-instructions.mjs"), "--root", root], { encoding: "utf8" })
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it("rejects the retired orchestration instruction in an active entrypoint", () => {
  const root = fixture()
  writeFileSync(join(root, "AGENTS.md"), "Renew Sprint supplies orchestration and the current model/usage trial.\n")
  const result = check(root)
  expect(result.status).toBe(1)
  expect(result.stdout).toContain("retired_sprint_orchestration")
})

it("accepts current pointers while preserving historical ADR evidence", () => {
  const root = fixture()
  mkdirSync(join(root, "docs/adr"), { recursive: true })
  writeFileSync(join(root, "docs/adr/retired.md"), "Renew Sprint supplies orchestration and the current model/usage trial.\n")
  const result = check(root)
  expect(result.status).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ state: "pass", findings: [] })
})
