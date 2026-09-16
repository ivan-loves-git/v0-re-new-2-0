import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

const instructionPaths = [
  "AGENTS.md", "CLAUDE.md", "START-HERE.md",
  "docs/TESTING_RELEASE_PROTOCOL.md", "docs/commit-style.md",
]

function execute(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", timeout: 8_000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GH_PROMPT_DISABLED: "1" },
  })
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}

function githubRepository(remote) {
  // Return only a validated owner/repository, never a credential-bearing remote URL.
  const match = remote.trim().match(/^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  return match ? `${match[1]}/${match[2]}` : null
}

function withinRoot(root, path) {
  const rel = relative(root, path)
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)
}

function localInstruction(root, path) {
  const full = resolve(root, path)
  try {
    const stat = lstatSync(full)
    if (stat.isSymbolicLink() || !stat.isFile() || !withinRoot(root, realpathSync(full))) {
      return { state: "unreadable", reason: "not_a_regular_file_inside_repository" }
    }
    const content = readFileSync(full)
    const sha = createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex")
    return { state: "present", sha }
  } catch (error) {
    return { state: error.code === "ENOENT" ? "missing" : "unreadable" }
  }
}

function nestedRepository(root, path) {
  try {
    const full = resolve(root, path)
    if (!withinRoot(root, realpathSync(full)) || !lstatSync(full).isDirectory()) return false
    lstatSync(resolve(full, ".git"))
    return true
  } catch {
    return false
  }
}

function parseChanges(stdout, root) {
  const entries = stdout.split("\0")
  const tracked = [], untracked = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    const status = entry.slice(0, 2), path = entry.slice(3)
    const change = { path, status, nested_repository: nestedRepository(root, path) }
    if (/[RC]/.test(status)) change.previous_path = entries[++i]
    if (status === "??") untracked.push(change)
    else tracked.push(change)
  }
  return { state: tracked.length || untracked.length ? "changes_present" : "clean", tracked, untracked }
}

export function inspectContext({ cwd = process.cwd(), offline = false, runner = execute } = {}) {
  const git = (...args) => runner("git", args, cwd)
  const rootResult = git("rev-parse", "--show-toplevel")
  if (rootResult.status !== 0) {
    return { schema: 1, read_only: true, state: "invalid", reason: "not_a_git_repository" }
  }
  let root
  try { root = realpathSync(rootResult.stdout.trim()) } catch {
    return { schema: 1, read_only: true, state: "invalid", reason: "repository_root_unavailable" }
  }
  const value = (...args) => {
    const result = git(...args)
    return result.status === 0 ? result.stdout.trim() : null
  }
  const head = value("rev-parse", "--verify", "HEAD")
  const origin = value("remote", "get-url", "origin")
  const repository = origin ? githubRepository(origin) : null
  const status = git("status", "--porcelain=v1", "-z", "--untracked-files=normal")
  const report = {
    schema: 1, read_only: true, observed_at: new Date().toISOString(), state: "ok", root,
    repository,
    local: {
      branch: value("symbolic-ref", "--quiet", "--short", "HEAD"), head,
      upstream: value("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"),
      upstream_sha: value("rev-parse", "--verify", "@{upstream}"),
    },
    working_tree: status.status === 0 ? parseChanges(status.stdout, root) : { state: "unknown", tracked: [], untracked: [] },
    remote: { state: "unknown", reason: offline ? "offline_requested" : repository ? "github_unavailable" : "no_supported_github_origin" },
    comparison: "unknown", instructions: [],
  }
  // Local root is canonical; all API paths are built from the validated GitHub slug.
  const api = (endpoint, query) => {
    const result = runner("gh", ["api", "--hostname", "github.com", "--method", "GET", endpoint, "--jq", query], root)
    if (result.status !== 0) return { state: /HTTP 404/.test(result.stderr) ? "missing" : "unknown" }
    try { return { state: "ok", value: JSON.parse(result.stdout) } } catch { return { state: "unknown" } }
  }
  if (!offline && repository) {
    const metadata = api(`repos/${repository}`, "{default_branch}")
    const branch = metadata.value?.default_branch
    if (typeof branch === "string" && branch) {
      const commit = api(`repos/${repository}/commits/${encodeURIComponent(branch)}`, "{sha}")
      const sha = commit.value?.sha
      if (typeof sha === "string" && /^[a-f0-9]{40}$/.test(sha)) {
        report.remote = { state: "known", repository, branch, sha, source: "github_api", observed_at: new Date().toISOString() }
        report.comparison = head ? head === sha ? "same_revision" : "different_revision" : "unknown"
      }
    }
  }
  for (const path of instructionPaths) {
    const local = localInstruction(root, path)
    let remote = { state: "unknown" }
    if (report.remote.state === "known") {
      // Only metadata is consumed. Remote document contents never enter the report.
      const result = api(`repos/${repository}/contents/${path}?ref=${report.remote.sha}`, "{type,sha}")
      if (result.state === "missing") remote = { state: "missing" }
      else if (result.value?.type === "file" && /^[a-f0-9]{40}$/.test(result.value.sha)) remote = { state: "present", sha: result.value.sha }
    }
    let comparison = "unknown"
    if (local.state === "present" && remote.state === "present") comparison = local.sha === remote.sha ? "identical" : "different"
    else if (local.state === "missing" && remote.state === "missing") comparison = "absent_both"
    else if (local.state === "present" && remote.state === "missing") comparison = "local_only"
    else if (local.state === "missing" && remote.state === "present") comparison = "missing_locally"
    report.instructions.push({ path, local, remote, comparison })
  }
  if (!head || report.remote.state === "unknown" || report.working_tree.state === "unknown"
    || report.instructions.some((item) => item.comparison === "unknown")) report.state = "partial"
  return report
}

export function formatContext(report) {
  if (report.state === "invalid") return `Repository context unavailable: ${report.reason}.`
  const short = (sha) => sha?.slice(0, 12) ?? "unknown"
  const lines = [
    `Repository: ${report.repository ?? "unknown (no supported GitHub origin)"}`,
    `Root: ${JSON.stringify(report.root)}`,
    `Local: ${JSON.stringify(report.local.branch ?? "detached/unborn")} ${short(report.local.head)}`,
    `Cached upstream: ${report.local.upstream ?? "none"} ${short(report.local.upstream_sha)}`,
    report.remote.state === "known"
      ? `GitHub ${JSON.stringify(report.remote.branch)}: ${short(report.remote.sha)} (${report.remote.observed_at})`
      : `GitHub: unknown (${report.remote.reason})`,
    `Revision comparison: ${report.comparison}`,
    `Working tree: ${report.working_tree.state}; tracked ${report.working_tree.tracked.length}, untracked entries ${report.working_tree.untracked.length}`,
  ]
  for (const group of ["tracked", "untracked"]) for (const item of report.working_tree[group]) {
    lines.push(`  ${item.status} ${JSON.stringify(item.path)}${item.previous_path ? ` from ${JSON.stringify(item.previous_path)}` : ""}${item.nested_repository ? " (nested repository boundary)" : ""}`)
  }
  lines.push("Instruction identity against the observed GitHub revision:")
  for (const item of report.instructions) lines.push(`  ${item.path}: ${item.comparison}`)
  lines.push("Read-only orientation. Changes and instruction differences require review; they are not defects or release approval.")
  return lines.join("\n")
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help")) {
    console.log("Usage: node scripts/agent-context.mjs [--json] [--offline] [--cwd PATH]\nReads local Git state and GitHub default-branch instruction identity. Does not change repository state.")
    return
  }
  let cwd = process.cwd()
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cwd" && args[i + 1] && !args[i + 1].startsWith("--")) cwd = resolve(args[++i])
    else if (!["--json", "--offline"].includes(args[i])) {
      console.error("Invalid argument. Use --help.")
      process.exitCode = 2
      return
    }
  }
  const report = inspectContext({ cwd, offline: args.includes("--offline") })
  console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatContext(report))
  if (report.state === "invalid") process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
