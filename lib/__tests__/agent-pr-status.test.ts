import { afterEach, describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { inspectPrStatus, formatPrStatus } from "../../scripts/agent-pr-status.mjs"

const head = "a".repeat(40), base = "b".repeat(40)
const pr = { number: 136, state: "OPEN", isDraft: true, headRefOid: head, baseRefOid: base, baseRefName: "release/next", mergeStateStatus: "CLEAN" }
const baseRef = { ref: "refs/heads/release/next", object: { type: "commit", sha: base } }
const check = (name = "Verify", bucket = "pass", state = "SUCCESS", event = "pull_request") => ({
  name, bucket, state, event, workflow: "Verify", link: `https://github.com/example/project/actions/runs/${event === "push" ? 2 : 1}/job/3`,
})
type Options = {
  first?: object | null; after?: object | null; all?: object[] | null; required?: object[] | null
  comparison?: object | null; checkExit?: number; root?: string
  baseRef?: object | null; baseRefAfter?: object | null
}
function mock(options: Options = {}) {
  const calls: string[][] = []
  let views = 0, refs = 0
  const runner = (command: string, args: string[], cwd: string) => {
    calls.push([command, ...args])
    if (command === "git") {
      if (!options.root) throw new Error("Unexpected local Git read")
      return spawnSync(command, args, { cwd, encoding: "utf8" })
    }
    let value: unknown, status = 0
    if (args[0] === "pr" && args[1] === "view") {
      value = views++ === 0 ? options.first === undefined ? pr : options.first : options.after === undefined ? pr : options.after
    } else if (args[0] === "api" && args[5].includes("/git/ref/heads/")) {
      const initial = options.baseRef === undefined ? baseRef : options.baseRef
      value = refs++ === 0 || options.baseRefAfter === undefined ? initial : options.baseRefAfter
    } else if (args[0] === "api") {
      value = options.comparison === undefined ? { status: "ahead", ahead_by: 1, behind_by: 0 } : options.comparison
    } else if (args[0] === "pr" && args[1] === "checks") {
      value = args.includes("--required") ? options.required === undefined ? [check()] : options.required : options.all === undefined ? [check(), check("Security")] : options.all
      status = options.checkExit ?? 0
    } else throw new Error("Unexpected command")
    return value === null ? { status: 1, stdout: "private response", stderr: "secret-token" }
      : { status, stdout: JSON.stringify(value), stderr: "" }
  }
  return { runner, calls }
}
function inspect(options: Options = {}) {
  const mocked = mock(options)
  const result = JSON.parse(JSON.stringify(inspectPrStatus({ pr: 136, repository: "example/project", runner: mocked.runner })))
  return { result, ...mocked }
}
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe("read-only explicit PR evidence", () => {
  it("pins comparison to observed commits, separates required checks and retains draft authority boundaries", () => {
    const { result, calls } = inspect()
    expect(result).toMatchObject({ state: "complete", read_only: true, authority: "not_assessed", production: "not_assessed", pr: { isDraft: true }, snapshot: { state: "stable_at_observation" } })
    expect(result.comparison).toMatchObject({ base_sha: base, head_sha: head, ahead_by: 1, behind_by: 0 })
    expect(result.required).toMatchObject({ summary: "pass", checks: [check()] })
    expect(result.supplemental.checks).toHaveLength(1)
    expect(calls.some((args) => args.includes(`repos/example/project/compare/${base}...${head}`))).toBe(true)
    expect(calls.filter((args) => args[1] === "pr").every((args) => args.includes("github.com/example/project"))).toBe(true)
    expect(formatPrStatus(result)).toContain('Live base: "release/next"')
    expect(calls.filter((args) => args.includes("repos/example/project/git/ref/heads/release%2Fnext"))).toHaveLength(2)
    expect(formatPrStatus(result)).toContain("production status are not assessed")
  })

  it("compares the live branch when unchanged PR metadata still records an older base", () => {
    const live = "c".repeat(40)
    const { result, calls } = inspect({
      baseRef: { ...baseRef, object: { type: "commit", sha: live } },
      comparison: { status: "diverged", ahead_by: 2, behind_by: 1 },
    })
    expect(result).toMatchObject({ state: "partial", base: { recorded_sha: base, live_sha: live, metadata_match: false }, comparison: { base_sha: live, behind_by: 1 } })
    expect(result.reasons).toContain("pr_base_metadata_outdated")
    expect(result.required.summary).toBe("unknown")
    expect(result.supplemental.summary).toBe("unknown")
    expect(calls.some((args) => args.includes(`repos/example/project/compare/${live}...${head}`))).toBe(true)
    expect(calls.some((args) => args.includes(`repos/example/project/compare/${base}...${head}`))).toBe(false)
    expect(formatPrStatus(result)).toContain(`PR-recorded base: ${base}`)
    expect(formatPrStatus(result)).toContain("behind 1")
  })

  it("invalidates a moving live branch even when both PR metadata reads are unchanged", () => {
    const { result } = inspect({ baseRefAfter: { ...baseRef, object: { type: "commit", sha: "c".repeat(40) } } })
    expect(result).toMatchObject({ state: "stale_snapshot", snapshot: { state: "changed" }, required: { summary: "unknown" }, supplemental: { summary: "unknown" } })
    expect(result.reasons).toContain("live_base_changed_during_collection")
  })

  it.each([
    null,
    { ...baseRef, object: { type: "commit", sha: "invalid" } },
    { ...baseRef, object: { type: "tag", sha: base } },
    { ...baseRef, ref: "refs/heads/other" },
  ])("never falls back to PR metadata when the live base ref is unavailable or invalid (%j)", (value) => {
    const { result, calls } = inspect({ baseRef: value })
    expect(result).toMatchObject({ state: "partial", comparison: { state: "unknown" }, required: { summary: "unknown" } })
    expect(calls.some((args) => args.some((arg) => arg.includes("/compare/")))).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/secret-token|private response/)
  })

  it("keeps observed checks but invalidates summaries when the final live base read fails", () => {
    const { result } = inspect({ baseRefAfter: null })
    expect(result).toMatchObject({ state: "partial", snapshot: { state: "unknown" }, required: { summary: "unknown" }, supplemental: { summary: "unknown" } })
    expect(result.required.checks).toHaveLength(1)
    expect(result.reasons).toContain("live_base_recheck_unavailable")
  })

  it.each([
    ["fail", "FAILURE", 1], ["pending", "IN_PROGRESS", 8], ["cancel", "CANCELLED", 1],
    ["skipping", "SKIPPED", 0], ["pass", "NEUTRAL", 0],
  ])("retains %s check evidence without treating collection as a release gate", (bucket, state, code) => {
    const item = check("Verify", bucket as string, state as string)
    const { result } = inspect({ all: [item], required: [item], checkExit: code as number })
    expect(result.state).toBe("complete")
    expect(result.required.summary).toBe(bucket)
    expect(result.required.checks[0].state).toBe(state)
  })

  it("does not collapse required checks sharing a name across push and PR events", () => {
    const push = check("Verify", "fail", "FAILURE", "push")
    const { result } = inspect({ all: [check(), push, check("Security")], required: [check(), push], checkExit: 1 })
    expect(result.required.checks).toHaveLength(2)
    expect(result.required.summary).toBe("fail")
    expect(result.supplemental.checks.map((item: { name: string }) => item.name)).toEqual(["Security"])
  })

  it.each(["headRefOid", "baseRefOid", "baseRefName", "state", "isDraft"])("invalidates the snapshot when %s changes during collection", (field) => {
    const value = field.endsWith("Oid") ? "c".repeat(40) : field === "isDraft" ? false : field === "state" ? "CLOSED" : "other"
    const { result } = inspect({ after: { ...pr, [field]: value } })
    expect(result.state).toBe("stale_snapshot")
    expect(result.required.summary).toBe("unknown")
    expect(result.supplemental.summary).toBe("unknown")
  })

  it("keeps unavailable required evidence unknown despite passing other checks", () => {
    const { result } = inspect({ required: null })
    expect(result.state).toBe("partial")
    expect(result.required.summary).toBe("unknown")
    expect(JSON.stringify(result)).not.toMatch(/secret-token|private response/)
  })

  it("does not retain aggregate passes when the exact base comparison is unavailable", () => {
    const { result } = inspect({ comparison: null })
    expect(result).toMatchObject({ state: "partial", comparison: { state: "unknown" }, required: { summary: "unknown" }, supplemental: { summary: "unknown" } })
    expect(result.required.checks).toHaveLength(1)
    expect(formatPrStatus(result)).not.toContain("checks: pass")
  })

  it("does not describe absent required checks as passing", () => {
    const { result } = inspect({ all: [], required: [] })
    expect(result).toMatchObject({ state: "partial", required: { summary: "none_reported" } })
    expect(result.reasons).toContain("no_required_checks_reported")
  })

  it("invalidates inconsistent check views even if the PR head has not changed", () => {
    const { result } = inspect({ required: [check("Verify", "pending", "QUEUED")] })
    expect(result.state).toBe("partial")
    expect(result.required.summary).toBe("unknown")
    expect(result.reasons).toContain("check_views_changed_or_inconsistent")
  })

  it("handles missing PR, malformed check rows, and a failed final reread conservatively", () => {
    expect(inspect({ first: null }).result.state).toBe("unavailable")
    expect(inspect({ first: { ...pr, number: 999 } }).result.state).toBe("unavailable")
    expect(inspect({ all: [{}] }).result.required.summary).toBe("unknown")
    expect(inspect({ after: null }).result.required.summary).toBe("unknown")
    expect(inspect({ comparison: { status: "ahead", ahead_by: -1, behind_by: 0 } }).result.comparison.state).toBe("unknown")
    const unknown = check("Verify", "future_state", "FUTURE_STATE")
    expect(inspect({ all: [unknown], required: [unknown] }).result.required.summary).toBe("unknown")
  })

  it("reports divergent base and closed/merged PR facts without an approval or production claim", () => {
    const closed = { ...pr, state: "MERGED", isDraft: false }
    const { result } = inspect({ first: closed, after: closed, comparison: { status: "diverged", ahead_by: 2, behind_by: 3 } })
    expect(result).toMatchObject({ state: "complete", pr: { state: "MERGED" }, comparison: { status: "diverged", behind_by: 3 }, production: "not_assessed" })
  })

  it("strips unsafe links and quotes check names in human output", () => {
    const unsafe = { ...check("unsafe\nname"), link: "https://secret-token@github.com/private?token=secret" }
    const { result } = inspect({ all: [check(), unsafe] })
    expect(JSON.stringify(result)).not.toContain("secret")
    expect(formatPrStatus(result)).toContain('"unsafe\\nname"')
  })

  it("uses only origin metadata and leaves a real dirty repository and ignored secrets untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "renew-pr-status-")); roots.push(root)
    const git = (...args: string[]) => {
      const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, encoding: "utf8" })
      expect(result.status).toBe(0); return result.stdout
    }
    git("init", "-b", "main")
    writeFileSync(join(root, ".gitignore"), ".env.local\n"); git("add", ".gitignore")
    writeFileSync(join(root, ".env.local"), "private secret content")
    git("remote", "add", "origin", "https://user:private-token@github.com/example/project.git")
    const index = readFileSync(join(root, ".git/index")), config = readFileSync(join(root, ".git/config"))
    const { runner, calls } = mock({ root })
    const result = JSON.parse(JSON.stringify(inspectPrStatus({ pr: 136, cwd: root, runner })))
    expect(result.repository).toBe("example/project")
    expect(JSON.stringify(result)).not.toMatch(/private-token|private secret/)
    expect(readFileSync(join(root, ".git/index"))).toEqual(index)
    expect(readFileSync(join(root, ".git/config"))).toEqual(config)
    expect(calls.filter((args) => args[0] === "git")).toEqual([["git", "remote", "get-url", "origin"]])
    expect(calls.filter((args) => args[1] === "api").every((args) => args.includes("GET"))).toBe(true)
  })

  it("rejects missing/malformed arguments before network activity", () => {
    const never = () => { throw new Error("Must not execute") }
    expect(inspectPrStatus({ pr: 0, runner: never }).state).toBe("invalid")
    expect(inspectPrStatus({ pr: 136, repository: "https://user:token@github.com/a/b", runner: never }).state).toBe("invalid")
    const script = resolve("scripts/agent-pr-status.mjs")
    for (const args of [[], ["--pr"], ["--pr", "1e2"], ["--pr", "-1"], ["--pr", "1", "--pr", "2"], ["--unknown"]]) {
      expect(spawnSync(process.execPath, [script, ...args], { encoding: "utf8" }).status).toBe(2)
    }
    expect(spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" }).status).toBe(0)
  })
})
