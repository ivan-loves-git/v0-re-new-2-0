import { afterEach, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it("writes private non-secret evidence and a concise dry-run result from an explicit source", () => {
  const root = mkdtempSync(join(tmpdir(), "renew-email-ops-cli-"))
  roots.push(root)
  const envFile = join(root, "source.env")
  const evidence = join(root, "proof.json")
  writeFileSync(envFile, [
    "NEXT_PUBLIC_SUPABASE_URL=https://iiuqcdnmxhtyispnykgf.supabase.co",
    "QA_REPRENEUR_EMAIL=owned@example.invalid",
    "QA_REPRENEUR_PASSWORD=canary-password-no-export",
    "RESEND_API_KEY=canary-key-no-export",
  ].join("\n"), { mode: 0o600 })
  const result = spawnSync(process.execPath, [resolve("scripts/email-operations.mjs"), "role", "--env-file", envFile,
    "--qa-recipient", "owned@example.invalid", "--evidence-file", evidence], { encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://unrelated.supabase.co" } })
  expect(result.status).toBe(0)
  expect(result.stdout).toContain("requires_execution")
  const saved = readFileSync(evidence, "utf8")
  expect(JSON.parse(saved)).toMatchObject({ state: "requires_execution", readOnly: true })
  expect(result.stdout + result.stderr + saved).not.toMatch(/canary-|session_token/)
  expect(statSync(evidence).mode & 0o777).toBe(0o600)
})

it.each(["existing", "symlink", "checkout"])("refuses an unsafe %s evidence destination without altering it", kind => {
  const root = mkdtempSync(join(tmpdir(), "renew-email-ops-private-"))
  roots.push(root)
  const envFile = join(root, "source.env")
  writeFileSync(envFile, "NEXT_PUBLIC_SUPABASE_URL=https://iiuqcdnmxhtyispnykgf.supabase.co\nQA_REPRENEUR_EMAIL=owned@example.invalid\nQA_REPRENEUR_PASSWORD=canary-private\n")
  const retained = kind === "checkout" ? resolve("AGENTS.md") : join(root, "retained.json")
  if (kind !== "checkout") writeFileSync(retained, "existing proof")
  const before = readFileSync(retained, "utf8")
  const destination = kind === "symlink" ? join(root, "link.json") : retained
  if (kind === "symlink") symlinkSync(retained, destination)
  const result = spawnSync(process.execPath, [resolve("scripts/email-operations.mjs"), "role", "--env-file", envFile,
    "--qa-recipient", "owned@example.invalid", "--evidence-file", destination], { encoding: "utf8" })
  expect(result.status).toBe(2)
  expect(readFileSync(retained, "utf8")).toBe(before)
  expect(result.stdout + result.stderr).not.toMatch(/canary-|session_token/)
})
