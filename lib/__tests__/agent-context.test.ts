import { afterEach, describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { inspectContext, formatContext } from "../../scripts/agent-context.mjs"

const roots: string[] = []
function temporary() { const path = mkdtempSync(join(tmpdir(), "renew-agent-context-")); roots.push(path); return path }
function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}
function fixture() {
  const root = temporary()
  git(root, "init", "-b", "trunk")
  git(root, "config", "user.email", "qa@example.invalid")
  git(root, "config", "user.name", "Synthetic QA")
  git(root, "config", "commit.gpgsign", "false")
  writeFileSync(join(root, "AGENTS.md"), "# Current instructions\n")
  writeFileSync(join(root, "rename me.txt"), "rename fixture\n")
  writeFileSync(join(root, "delete.txt"), "delete fixture\n")
  writeFileSync(join(root, ".gitignore"), ".env*\n")
  git(root, "add", "."); git(root, "commit", "-qm", "fixture")
  return root
}
function blob(value: string) { return createHash("sha1").update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest("hex") }
function runnerFor(root: string, options: { unavailable?: boolean; sha?: string; instructionSha?: string } = {}) {
  const calls: string[][] = []
  const runner = (command: string, args: string[], cwd: string) => {
    calls.push([command, ...args])
    if (command === "git") {
      const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } })
      return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
    }
    if (options.unavailable) return { status: 1, stdout: "", stderr: "private credential must not leak" }
    const endpoint = args[5]
    let value: object
    if (endpoint === "repos/example/project") value = { default_branch: "trunk" }
    else if (endpoint === "repos/example/project/commits/trunk") value = { sha: options.sha ?? git(root, "rev-parse", "HEAD") }
    else if (endpoint.startsWith("repos/example/project/contents/AGENTS.md?ref=")) value = { type: "file", sha: options.instructionSha ?? blob("# Current instructions\n") }
    else return { status: 1, stdout: "", stderr: "HTTP 404" }
    return { status: 0, stdout: JSON.stringify(value), stderr: "" }
  }
  return { runner, calls }
}
// Round-trip the CLI's public JSON contract rather than relying on internal JS inference.
function report(root: string, options: Parameters<typeof inspectContext>[0] = {}) {
  return JSON.parse(JSON.stringify(inspectContext({ cwd: root, ...options })))
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe("read-only repository context", () => {
  it("uses the live default branch instead of a stale cached remote reference", () => {
    const root = fixture()
    git(root, "remote", "add", "origin", "https://github.com/example/project.git")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    const { runner, calls } = runnerFor(root, { sha: "a".repeat(40) })
    const before = readFileSync(join(root, ".git/index"))
    const result = report(root, { runner })
    expect(result.remote).toMatchObject({ state: "known", branch: "trunk", sha: "a".repeat(40) })
    expect(result.comparison).toBe("different_revision")
    expect(result.instructions.find((item: { path: string }) => item.path === "AGENTS.md").comparison).toBe("identical")
    expect(readFileSync(join(root, ".git/index"))).toEqual(before)
    expect(git(root, "status", "--porcelain")).toBe("")
    expect(calls.filter(([command]) => command === "gh").every((args) => args.includes("GET"))).toBe(true)
    expect(calls.some((args) => args.some((arg) => ["fetch", "pull", "reset", "stash"].includes(arg)))).toBe(false)
  })

  it("reports equal revisions and different instruction content independently", () => {
    const root = fixture()
    git(root, "remote", "add", "origin", "git@github.com:example/project.git")
    const { runner } = runnerFor(root, { instructionSha: "b".repeat(40) })
    const result = report(root, { runner })
    expect(result.comparison).toBe("same_revision")
    expect(result.instructions[0].comparison).toBe("different")
  })

  it("matches Git blob identity for non-ASCII instruction bytes", () => {
    const root = fixture(), contents = "# Re-New\nDécision approuvée · possibilità 🌊\n"
    writeFileSync(join(root, "AGENTS.md"), contents)
    git(root, "remote", "add", "origin", "https://github.com/example/project.git")
    const { runner } = runnerFor(root, { instructionSha: git(root, "hash-object", "AGENTS.md") })
    const result = report(root, { runner })
    expect(result.instructions[0].comparison).toBe("identical")
  })

  it("reports staged, unstaged, deleted, renamed and nested entries without reading ignored secrets", () => {
    const root = fixture()
    writeFileSync(join(root, "AGENTS.md"), "changed\n")
    git(root, "mv", "rename me.txt", "renamed\nfile.txt")
    git(root, "rm", "delete.txt")
    writeFileSync(join(root, "new.txt"), "untracked\n")
    writeFileSync(join(root, ".env.local"), "DO_NOT_READ=private\n")
    mkdirSync(join(root, "nested")); git(join(root, "nested"), "init", "-b", "main")
    const result = report(root, { offline: true })
    expect(result.working_tree.state).toBe("changes_present")
    expect(result.working_tree.tracked).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "AGENTS.md", status: " M" }),
      expect.objectContaining({ path: "delete.txt", status: "D " }),
      expect.objectContaining({ path: "renamed\nfile.txt", status: "R ", previous_path: "rename me.txt" }),
    ]))
    expect(result.working_tree.untracked).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "new.txt" }),
      expect.objectContaining({ path: "nested/", nested_repository: true }),
    ]))
    expect(JSON.stringify(result)).not.toContain(".env.local")
    expect(formatContext(result)).toContain('"renamed\\nfile.txt"')
  })

  it("keeps missing origin, unavailable GitHub and detached HEAD useful but unknown", () => {
    const root = fixture()
    git(root, "checkout", "--detach", "-q")
    expect(report(root, { offline: true })).toMatchObject({ state: "partial", comparison: "unknown", local: { branch: null } })
    git(root, "remote", "add", "origin", "https://user:private-token@github.com/example/project.git")
    const { runner } = runnerFor(root, { unavailable: true })
    const result = report(root, { runner })
    expect(result.remote.state).toBe("unknown")
    expect(JSON.stringify(result)).not.toMatch(/private-token|private credential/)
    expect(result.repository).toBe("example/project")
  })

  it("does not follow a local instruction symlink outside the repository", () => {
    const root = fixture(), external = temporary()
    writeFileSync(join(external, "secret"), "not agent instructions")
    rmSync(join(root, "AGENTS.md")); symlinkSync(join(external, "secret"), join(root, "AGENTS.md"))
    expect(report(root, { offline: true }).instructions[0].local.state).toBe("unreadable")
  })

  it("CLI produces JSON offline and rejects malformed arguments without modifying the repository", () => {
    const root = fixture(), script = resolve("scripts/agent-context.mjs")
    const result = spawnSync(process.execPath, [script, "--cwd", root, "--offline", "--json"], { encoding: "utf8" })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ read_only: true, working_tree: { state: "clean" }, remote: { state: "unknown" } })
    expect(spawnSync(process.execPath, [script, "--cwd"], { encoding: "utf8" }).status).toBe(2)
    expect(spawnSync(process.execPath, [script, "--cwd", temporary(), "--offline"], { encoding: "utf8" }).status).toBe(2)
    expect(git(root, "status", "--porcelain")).toBe("")
  })
})
