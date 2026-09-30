import { afterEach, describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const script = resolve("scripts/check-ma-data-model-sync.mjs")
const contract = "docs/data-models/ma-advisory-data-model-v1.md"
const roots: string[] = []
const originalContract = "# Contract\n\n## Change log\n\n| Date | Reason |\n| --- | --- |\n| 2026-01-01 | Initial |\n"
function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}
function write(root: string, path: string, contents: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), contents)
}
function commit(root: string) { git(root, "add", "."); git(root, "commit", "-qm", "synthetic change") }
function fixture(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "renew-model-check-")); roots.push(root)
  git(root, "init", "-b", "main")
  git(root, "config", "user.email", "qa@example.invalid")
  git(root, "config", "user.name", "Synthetic QA")
  git(root, "config", "commit.gpgsign", "false")
  write(root, contract, originalContract)
  for (const [path, content] of Object.entries(files)) write(root, path, content)
  commit(root)
  return root
}
function run(root: string, base = "") {
  return spawnSync(process.execPath, [script], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, DATA_MODEL_BASE_REF: base, GITHUB_BASE_REF: "" },
  })
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe("M&A contract checker behavior", () => {
  it.each(["mjs", "js", "ts", "tsx", "py"])("detects an untracked %s import mapping", (extension) => {
    const root = fixture()
    write(root, `scripts/custom-import.${extension}`, 'export const mapping = { opportunity_id: "source.target" }\n')
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("M&A data contract update required")
  })

  it.each(["staged", "unstaged", "committed"])("detects a literal-only %s treatment change in a known mapping module", (mode) => {
    const path = "scripts/pursuit-workbook-v4.mjs"
    const root = fixture({ [path]: 'export function targetStatus() {\n  return "draft"\n}\n' })
    write(root, path, 'export function targetStatus() {\n  return "dropped"\n}\n')
    if (mode === "staged") git(root, "add", path)
    if (mode === "committed") commit(root)
    expect(run(root).status).toBe(1)
  })

  it("accepts a qualifying change with its contract and a newly dated change-log row", () => {
    const root = fixture()
    write(root, "scripts/import-new.ts", 'const source_office_id = "canonicalOffice"\n')
    write(root, contract, originalContract + "| 2026-09-15 | Change mapping under GitHub #145 |\n")
    expect(run(root).status).toBe(0)
  })

  it.each(["scripts/historical-pursuit-manifest.mjs", "scripts/run-pursuit-workbook-v4.mjs"])("detects a treatment condition change in %s without model tokens on the changed line", (path) => {
    const root = fixture({ [path]: 'if (row.dropReason && hasTerminalMarker) return "terminal"\n' })
    write(root, path, 'if (hasTerminalMarker) return "terminal"\n')
    expect(run(root).status).toBe(1)
  })

  it.each(["scripts/parse-historical-pursuit-workbook.py", "scripts/parse-pursuit-workbook-v4.py"])("detects a source-column edit in %s", (path) => {
    const root = fixture({ [path]: 'dropReason = cells.get("O")\n' })
    write(root, path, 'dropReason = cells.get("P")\n')
    expect(run(root).status).toBe(1)
  })

  it.each(["scripts/116_historical_pursuit_ledger.sql", "supabase/migrations/20260914230430_pursuit_workbook_v4.sql"])("detects a literal-only SQL treatment edit in %s", (path) => {
    const root = fixture({ [path]: "v_status := 'dropped';\n" })
    write(root, path, "v_status := 'draft';\n")
    expect(run(root).status).toBe(1)
  })

  it("requires a newly added change-log row, not an unchanged historic row", () => {
    const root = fixture()
    write(root, "scripts/import-new.ts", 'const source_office_id = "canonicalOffice"\n')
    write(root, contract, originalContract.replace("# Contract", "# Updated Contract"))
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("change log update required")
  })

  it.each([
    "scripts/import.test.mjs", "scripts/import.spec.ts", "scripts/fixtures/import.ts",
    "scripts/check-ma-data-model-sync.mjs", "lib/__tests__/mapping.test.ts",
  ])("does not treat %s as a production mapping change", (path) => {
    const root = fixture()
    write(root, path, 'const opportunity_id = "synthetic"\n')
    expect(run(root).status).toBe(0)
  })

  it("ignores a generic logging utility even when it mentions pursuit or import", () => {
    const root = fixture()
    write(root, "scripts/log-import.mjs", 'console.log("pursuit import complete")\n')
    expect(run(root).status).toBe(0)
  })

  it.each([
    ["scripts/999_change.sql", "alter table opportunities add column sample text;\n"],
    ["supabase/migrations/999_change.sql", "alter table ma_contacts add column sample text;\n"],
    ["lib/actions/import.ts", 'const source_office_id = "canonical"\n'],
    ["components/source.tsx", 'const source_office_id = "canonical"\n'],
  ])("retains existing coverage for %s", (path, content) => {
    const root = fixture(); write(root, path, content)
    expect(run(root).status).toBe(1)
  })

  it("compares the full explicit committed range rather than only the latest commit", () => {
    const root = fixture(), base = git(root, "rev-parse", "HEAD")
    write(root, "scripts/import.mjs", 'const opportunity_id = "new"\n'); commit(root)
    write(root, "README.md", "unrelated later commit\n"); commit(root)
    expect(run(root, base).status).toBe(1)
  })

  it("does not use an uncommitted contract row to approve the committed comparison", () => {
    const root = fixture(), base = git(root, "rev-parse", "HEAD")
    write(root, "scripts/import.ts", 'const opportunity_id = "new"\n'); commit(root)
    write(root, contract, originalContract + "| 2026-09-15 | Uncommitted |\n")
    expect(run(root, base).status).toBe(1)
  })

  it("reports an invalid requested base without silently falling back", () => {
    const root = fixture(), result = run(root, "not-a-real-ref")
    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Cannot assess")
    expect(result.stdout).not.toContain("synchronized")
  })

  it("detects deleted mapping code", () => {
    const path = "scripts/pursuit-workbook-v4.mjs", root = fixture({ [path]: 'export const desiredStatus = "draft"\n' })
    git(root, "rm", path)
    expect(run(root).status).toBe(1)
  })

  it("accepts rename-only changes but detects mapping edits made during a rename", () => {
    const path = "scripts/pursuit-workbook-v4.mjs"
    const initial = Array.from({ length: 20 }, (_, i) => `// context ${i}\n`).join("") + 'export const desiredStatus = "draft"\n'
    const root = fixture({ [path]: initial })
    git(root, "mv", path, "scripts/moved mapping.mjs")
    expect(run(root).status).toBe(0)
    write(root, "scripts/moved mapping.mjs", initial.replace('"draft"', '"dropped"'))
    expect(run(root).status).toBe(1)
  })

  it("handles whitespace and newlines in relevant script paths", () => {
    const root = fixture()
    write(root, "scripts/new\n mapping.ts", 'const opportunity_id = "new"\n')
    expect(run(root).status).toBe(1)
  })
})
