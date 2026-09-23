import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const slugPattern = /^[\w.-]+\/[\w.-]+$/
const shaPattern = /^[a-f0-9]{40}$/
const buckets = new Set(["pass", "fail", "pending", "skipping", "cancel"])
const prFields = "number,state,isDraft,headRefOid,baseRefOid,baseRefName,mergeStateStatus"
const checkFields = "name,state,bucket,workflow,event,link"

function execute(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", timeout: 15_000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GH_PROMPT_DISABLED: "1" },
  })
  return { status: result.status, stdout: result.stdout ?? "" }
}

function repositoryFromOrigin(value) {
  const match = value.trim().match(/^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  return match ? `${match[1]}/${match[2]}` : null
}

function evidenceLink(value) {
  try {
    const url = new URL(value)
    // Include GitHub evidence links only, without credentials, queries or fragments.
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password) return null
    return `${url.origin}${url.pathname}`
  } catch { return null }
}

function summary(items) {
  if (!items.length) return "none_reported"
  for (const bucket of ["unknown", "fail", "cancel", "pending", "skipping"]) {
    if (items.some((item) => item.bucket === bucket)) return bucket
  }
  return "pass"
}

/** @param {{pr?: number, repository?: string, cwd?: string, runner?: typeof execute}} [options] */
export function inspectPrStatus({ pr, repository, cwd = process.cwd(), runner = execute } = {}) {
  if (!Number.isSafeInteger(pr) || pr < 1 || (repository !== undefined && !slugPattern.test(repository))) {
    return { schema: 1, read_only: true, state: "invalid", reason: "explicit_positive_pr_and_valid_repository_required" }
  }
  if (!repository) {
    const origin = runner("git", ["remote", "get-url", "origin"], cwd)
    repository = origin.status === 0 ? repositoryFromOrigin(origin.stdout) : null
  }
  if (!repository) return { schema: 1, read_only: true, state: "invalid", reason: "supply_repository_or_supported_github_origin" }

  const json = (args, codes = [0]) => {
    try {
      const result = runner("gh", args, cwd)
      if (!codes.includes(result.status)) return null
      return JSON.parse(result.stdout)
    } catch { return null }
  }
  // Explicit github.com prevents a caller's GH_HOST setting from selecting another host.
  const repo = `github.com/${repository}`
  const readPr = () => {
    const value = json(["pr", "view", String(pr), "--repo", repo, "--json", prFields])
    return value?.number === pr && shaPattern.test(value.headRefOid) && shaPattern.test(value.baseRefOid)
      && typeof value.baseRefName === "string" && typeof value.isDraft === "boolean"
      && ["OPEN", "CLOSED", "MERGED"].includes(value.state) ? value : null
  }
  const before = readPr()
  const report = {
    schema: 1, read_only: true, state: "complete", observed_at: new Date().toISOString(),
    repository, url: `https://github.com/${repository}/pull/${pr}`, pr: before,
    base: { state: "unknown" }, comparison: { state: "unknown" },
    required: { state: "unknown", summary: "unknown", checks: [] },
    supplemental: { state: "unknown", summary: "unknown", checks: [] },
    snapshot: { state: "unknown" }, reasons: [],
    authority: "not_assessed", production: "not_assessed",
  }
  if (!before) {
    report.state = "unavailable"
    report.reasons.push("pr_unavailable_or_invalid")
    return report
  }
  const readBase = () => {
    const value = json([
      "api", "--hostname", "github.com", "--method", "GET",
      `repos/${repository}/git/ref/heads/${encodeURIComponent(before.baseRefName)}`,
    ])
    return value?.ref === `refs/heads/${before.baseRefName}` && value.object?.type === "commit"
      && shaPattern.test(value.object.sha) ? value.object.sha : null
  }
  // PR baseRefOid can lag behind the branch. Resolve the live ref independently, without falling back.
  const liveBase = readBase()
  report.base = {
    state: liveBase ? "known" : "unknown", branch: before.baseRefName,
    recorded_sha: before.baseRefOid, live_sha: liveBase,
    metadata_match: liveBase ? before.baseRefOid === liveBase : null, source: "github_git_ref",
  }
  if (!liveBase) report.reasons.push("live_base_unavailable")
  else if (!report.base.metadata_match) report.reasons.push("pr_base_metadata_outdated")
  const comparison = liveBase ? json([
    "api", "--hostname", "github.com", "--method", "GET",
    `repos/${repository}/compare/${liveBase}...${before.headRefOid}`,
    "--jq", "{status,ahead_by,behind_by}",
  ]) : null
  if (["identical", "ahead", "behind", "diverged"].includes(comparison?.status)
    && Number.isSafeInteger(comparison.ahead_by) && comparison.ahead_by >= 0
    && Number.isSafeInteger(comparison.behind_by) && comparison.behind_by >= 0) {
    report.comparison = { state: "known", ...comparison, base_sha: liveBase, head_sha: before.headRefOid }
  } else report.reasons.push("base_comparison_unavailable")

  const readChecks = (required) => {
    const value = json(["pr", "checks", String(pr), "--repo", repo, "--json", checkFields, ...(required ? ["--required"] : [])], [0, 1, 8])
    if (!Array.isArray(value) || value.some((item) => !item || typeof item.name !== "string"
      || typeof item.state !== "string" || typeof item.workflow !== "string"
      || typeof item.event !== "string" || typeof item.link !== "string")) return null
    return value.map((item) => ({
      name: item.name, state: item.state,
      bucket: item.state === "SKIPPED" ? "skipping" : item.state === "CANCELLED" ? "cancel" : buckets.has(item.bucket) ? item.bucket : "unknown",
      workflow: item.workflow, event: item.event, link: evidenceLink(item.link),
    }))
  }
  const all = readChecks(false), required = readChecks(true)
  if (all && required) {
    // Compare full identities and outcomes, retaining duplicate names and separate events.
    const supplemental = [...all]
    let consistent = true
    for (const check of required) {
      const index = supplemental.findIndex((item) => JSON.stringify(item) === JSON.stringify(check))
      if (index < 0) consistent = false
      else supplemental.splice(index, 1)
    }
    if (consistent) {
      report.required = { state: "known", summary: summary(required), checks: required }
      report.supplemental = { state: "known", summary: summary(supplemental), checks: supplemental }
      if (!required.length) report.reasons.push("no_required_checks_reported")
      if (all.some((item) => item.bucket === "unknown")) report.reasons.push("unrecognized_check_outcome")
    } else report.reasons.push("check_views_changed_or_inconsistent")
  } else report.reasons.push("check_evidence_unavailable")

  const after = readPr()
  const liveBaseAfter = readBase()
  report.finished_at = new Date().toISOString()
  if (!after) report.reasons.push("snapshot_recheck_unavailable")
  if (!liveBaseAfter) report.reasons.push("live_base_recheck_unavailable")
  const prChanged = after && ["headRefOid", "baseRefOid", "baseRefName", "state", "isDraft"].some((key) => before[key] !== after[key])
  const baseChanged = liveBase && liveBaseAfter && liveBase !== liveBaseAfter
  if (prChanged || baseChanged) {
    report.state = "stale_snapshot"
    report.snapshot = { state: "changed", after, live_base_after_sha: liveBaseAfter }
    if (prChanged) report.reasons.push("pr_changed_during_collection")
    if (baseChanged) report.reasons.push("live_base_changed_during_collection")
  } else if (after && liveBase && liveBaseAfter) {
    report.snapshot = { state: "stable_at_observation", head_sha: before.headRefOid, base_sha: liveBase }
  }
  if (report.snapshot.state !== "stable_at_observation" || report.comparison.state !== "known" || report.base.metadata_match !== true) {
    // Keep the observed rows as evidence, but never retain an aggregate pass for a stale/unverified snapshot.
    report.required.summary = "unknown"
    report.supplemental.summary = "unknown"
  }
  if (report.state !== "stale_snapshot" && report.reasons.length) report.state = "partial"
  return report
}

export function formatPrStatus(report) {
  if (report.state === "invalid") return `PR evidence unavailable: ${report.reason}.`
  const quote = (value) => JSON.stringify(value)
  const lines = [`PR evidence: ${report.url}`, `Collection: ${report.state} (${report.observed_at})`]
  if (report.pr) {
    lines.push(`PR: ${report.pr.state}${report.pr.isDraft ? " / draft" : ""}; head ${report.pr.headRefOid}`)
    lines.push(`PR-recorded base: ${report.pr.baseRefOid}`)
    lines.push(`Live base: ${quote(report.pr.baseRefName)} ${report.base.live_sha ?? "unknown"}`)
  }
  lines.push(report.comparison.state === "known"
    ? `Base comparison: ${report.comparison.status}; ahead ${report.comparison.ahead_by}, behind ${report.comparison.behind_by}`
    : "Base comparison: unknown")
  for (const group of ["required", "supplemental"]) {
    lines.push(`${group === "required" ? "Required" : "Supplemental"} checks: ${report[group].summary}`)
    for (const check of report[group].checks) lines.push(`  ${check.bucket}: ${quote(check.name)} / ${quote(check.workflow)} / ${quote(check.event)} (${quote(check.state)})${check.link ? ` ${check.link}` : ""}`)
  }
  lines.push(`Snapshot: ${report.snapshot.state}`)
  if (report.reasons.length) lines.push(`Evidence limits: ${report.reasons.join(", ")}`)
  lines.push("Read-only evidence at observation time. Merge/release authority and production status are not assessed.")
  return lines.join("\n")
}

function main() {
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"))
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: pnpm agent:pr-status --pr NUMBER [--repo OWNER/REPO] [--json]\nRead-only GitHub evidence. No workflow runs, repository changes or release actions.")
    return
  }
  const options = {}, seen = new Set()
  let asJson = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (seen.has(arg)) { process.exitCode = 2; console.error("Duplicate argument. Use --help."); return }
    seen.add(arg)
    if (arg === "--json") asJson = true
    else if (["--pr", "--repo"].includes(arg) && args[i + 1] && !args[i + 1].startsWith("--")) {
      const value = args[++i]
      if (arg === "--pr" && /^\d+$/.test(value)) options.pr = Number(value)
      else if (arg === "--repo") options.repository = value
      else { process.exitCode = 2; console.error("Invalid PR number. Use --help."); return }
    } else { process.exitCode = 2; console.error("Invalid argument. Use --help."); return }
  }
  const report = inspectPrStatus(options)
  console.log(asJson ? JSON.stringify(report, null, 2) : formatPrStatus(report))
  // Exit status describes collection, never a replacement release/CI gate.
  process.exitCode = report.state === "invalid" ? 2 : report.state === "complete" ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
