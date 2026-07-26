import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const contractPath = "docs/data-models/ma-advisory-data-model-v1.md"

const sqlModelTokens =
  /\b(ma_source_networks|ma_sources|ma_source_contacts|ma_source_contact_moves|ma_source_interactions|ma_firms|ma_offices|ma_contacts|ma_contact_office_affiliations|opportunities|opportunity_source_contacts|opportunity_ma_contacts|ma_interactions)\b/

const applicationModelTokens =
  /\b(ma_source_networks|ma_sources|ma_source_contacts|ma_source_contact_moves|ma_source_interactions|ma_firms|ma_offices|ma_contacts|ma_contact_office_affiliations|opportunity_source_contacts|opportunity_ma_contacts|ma_interactions|source_office_id|source_office|source_id|source_label|is_primary|primary_contact|contact_email|recipient_email|repreneur_exposure|opportunity_documents|imported_from|imported_at|date_added)\b/

function git(args, allowFailure = false) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  })

  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed\n`)
    process.exit(result.status ?? 1)
  }

  return result
}

function lines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function validRef(ref) {
  return git(["rev-parse", "--verify", "--quiet", ref], true).status === 0
}

function detectChangeSet() {
  const configuredBase = process.env.DATA_MODEL_BASE_REF
  const githubBase = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : undefined
  const baseRef = configuredBase || githubBase

  if (baseRef && validRef(baseRef)) {
    const range = `${baseRef}...HEAD`
    return {
      files: lines(git(["diff", "--name-only", range]).stdout),
      patchArgs: ["diff", "--unified=0", range],
      untracked: new Set(),
    }
  }

  const untracked = new Set(
    lines(git(["ls-files", "--others", "--exclude-standard"]).stdout),
  )
  const workingChanges = new Set([
    ...lines(git(["diff", "--name-only", "HEAD"]).stdout),
    ...untracked,
  ])

  if (workingChanges.size > 0) {
    return {
      files: [...workingChanges],
      patchArgs: ["diff", "--unified=0", "HEAD"],
      untracked,
    }
  }

  return {
    files: lines(
      git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).stdout,
    ),
    patchArgs: ["show", "--format=", "--unified=0", "HEAD"],
    untracked: new Set(),
  }
}

const changeSet = detectChangeSet()

function changedPatch(path) {
  if (changeSet.untracked.has(path) && existsSync(path)) {
    return readFileSync(path, "utf8")
      .split("\n")
      .map((line) => `+${line}`)
      .join("\n")
  }

  return git([...changeSet.patchArgs, "--", path], true).stdout
}

function patchLines(path, prefixes) {
  return changedPatch(path)
    .split("\n")
    .filter(
      (line) =>
        prefixes.some((prefix) => line.startsWith(prefix)) &&
        !line.startsWith("+++") &&
        !line.startsWith("---"),
    )
    .map((line) => line.slice(1))
    .join("\n")
}

function changedContent(path) {
  return patchLines(path, ["+", "-"])
}

function addedContent(path) {
  return patchLines(path, ["+"])
}

function hasAddedChangeLogRow() {
  if (!existsSync(contractPath)) {
    return false
  }

  const contract = readFileSync(contractPath, "utf8")
  const section = contract.split("## Change log\n")[1]?.split("\n## ")[0] ?? ""
  const currentRows = new Set(
    section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line)),
  )

  return addedContent(contractPath)
    .split("\n")
    .map((line) => line.trim())
    .some((line) => currentRows.has(line))
}

function isContractRelevant(path) {
  if (
    path.includes("/__tests__/") ||
    path.endsWith(".test.ts") ||
    path.endsWith(".test.tsx") ||
    path === "scripts/check-ma-data-model-sync.mjs"
  ) {
    return false
  }

  if (
    (path.startsWith("scripts/") ||
      path.startsWith("supabase/migrations/")) &&
    path.endsWith(".sql")
  ) {
    return sqlModelTokens.test(changedContent(path))
  }

  if (
    (path.startsWith("app/") ||
      path.startsWith("components/") ||
      path.startsWith("lib/")) &&
    (path.endsWith(".ts") || path.endsWith(".tsx"))
  ) {
    return applicationModelTokens.test(changedContent(path))
  }

  return false
}

const changed = changeSet.files
const relevant = changed.filter(isContractRelevant)

if (relevant.length > 0 && !changed.includes(contractPath)) {
  process.stderr.write(
    [
      "M&A data contract update required.",
      "",
      "These changed files can alter the M&A schema, validation or import mapping:",
      ...relevant.map((path) => `  - ${path}`),
      "",
      `Update ${contractPath} in the same change, including its reconciliation status and change log.`,
      "",
    ].join("\n"),
  )
  process.exit(1)
}

if (relevant.length > 0 && !hasAddedChangeLogRow()) {
  process.stderr.write(
    [
      "M&A data contract change log update required.",
      "",
      `A relevant implementation change and ${contractPath} were detected, but no dated change-log row changed.`,
      "Add the business reason and PDR or migration reference to the contract change log.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

process.stdout.write(
  relevant.length > 0
    ? `M&A data contract is synchronized with ${relevant.length} relevant changed file(s).\n`
    : "No M&A data contract update is required for the detected changes.\n",
)
