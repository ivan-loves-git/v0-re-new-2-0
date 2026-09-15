import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const contractPath = "docs/data-models/ma-advisory-data-model-v1.md"

const sqlModelTokens =
  /\b(ma_source_networks|ma_sources|ma_source_contacts|ma_source_contact_moves|ma_source_interactions|ma_firms|ma_offices|ma_contacts|ma_contact_office_affiliations|ma_contact_email_policy_events|opportunities|opportunity_source_contacts|opportunity_ma_contacts|ma_interactions)\b/

const applicationModelTokens =
  /\b(ma_source_networks|ma_sources|ma_source_contacts|ma_source_contact_moves|ma_source_interactions|ma_firms|ma_offices|ma_contacts|ma_contact_office_affiliations|ma_contact_email_policy_events|opportunity_source_contacts|opportunity_ma_contacts|ma_interactions|source_office_id|source_office|source_id|source_label|is_primary|primary_contact|contact_email|recipient_email|campaign_email_suppressed|campaign_email_suppression_reason|repreneur_exposure|opportunity_documents|imported_from|imported_at|date_added)\b/

// These modules own the historical source-to-record mapping documented in the
// canonical contract. A literal-only change can alter treatment without adding
// a model identifier, so review any substantive edit to these modules.
const importMappingModules = new Set([
  "scripts/prepare-historical-pursuit-import.mjs",
  "scripts/run-historical-pursuit-import.mjs",
  "scripts/pursuit-workbook-v4.mjs",
  "scripts/historical-pursuit-manifest.mjs",
  "scripts/run-pursuit-workbook-v4.mjs",
  "scripts/parse-historical-pursuit-workbook.py",
  "scripts/parse-pursuit-workbook-v4.py",
  "scripts/116_historical_pursuit_ledger.sql",
  "supabase/migrations/20260914230430_pursuit_workbook_v4.sql",
])
const importModelTokens = /\b(opportunities|opportunity_id|opportunityId|opportunityReference|repreneur_id|mapped_match_status|desiredStatus|changesExistingStatus|source_terminal|completedSourceStages|normalizedReference|import_match_before|import_match_after|historical_pursuit_import_rows)\b/

function git(args, allowFailure = false) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  })

  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed\n`)
    process.exit(result.status ?? 1)
  }

  return result
}

function paths(value) {
  return value.split("\0").filter(Boolean)
}

function resolveRef(ref) {
  const result = git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`], true)
  return result.status === 0 ? result.stdout.trim() : null
}

function comparison(patchArgs, committed, untracked = new Set()) {
  const entries = paths(git([...patchArgs, "--name-status", "-z"]).stdout)
  const pathspecs = new Map()
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i], path = entries[++i]
    if (status.startsWith("R") || status.startsWith("C")) {
      const destination = entries[++i]
      pathspecs.set(path, [path, destination])
      pathspecs.set(destination, [path, destination])
    } else pathspecs.set(path, [path])
  }
  for (const path of untracked) pathspecs.set(path, [path])
  return { files: [...pathspecs.keys()], pathspecs, patchArgs, committed, untracked }
}

function detectChangeSet() {
  const configuredBase = process.env.DATA_MODEL_BASE_REF
  const githubBase = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : undefined
  const baseRef = configuredBase || githubBase

  if (baseRef) {
    const base = resolveRef(baseRef)
    if (!base) {
      process.stderr.write("Cannot assess M&A contract changes: the requested base revision is unavailable. Provide a valid DATA_MODEL_BASE_REF; no fallback comparison was made.\n")
      process.exit(2)
    }
    return comparison(["diff", "--find-renames", `${base}...HEAD`], true)
  }

  const untracked = new Set(
    paths(git(["ls-files", "--others", "--exclude-standard", "-z"]).stdout),
  )
  const working = comparison(["diff", "--find-renames", "HEAD"], false, untracked)

  if (working.files.length > 0) return working

  const parent = resolveRef("HEAD^")
  return parent
    ? comparison(["diff", "--find-renames", parent, "HEAD"], true)
    : comparison(["show", "--format=", "--find-renames", "--root", "HEAD"], true)
}

const changeSet = detectChangeSet()

function changedPatch(path) {
  if (changeSet.untracked.has(path) && existsSync(path)) {
    return readFileSync(path, "utf8")
      .split("\n")
      .map((line) => `+${line}`)
      .join("\n")
  }

  return git([...changeSet.patchArgs, "--unified=0", "--", ...changeSet.pathspecs.get(path)]).stdout
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
  const snapshot = changeSet.committed
    ? git(["show", `HEAD:${contractPath}`], true)
    : null
  if (snapshot ? snapshot.status !== 0 : !existsSync(contractPath)) return false
  const contract = snapshot ? snapshot.stdout : readFileSync(contractPath, "utf8")
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
    path.includes("/fixtures/") ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    path === "scripts/check-ma-data-model-sync.mjs"
  ) {
    return false
  }

  if (importMappingModules.has(path)) {
    return changedContent(path).split("\n").some((line) =>
      line.trim() && !/^\s*(?:\/\/|\/\*|\*|\*\/|#|--)/.test(line),
    )
  }

  if (
    (path.startsWith("scripts/") ||
      path.startsWith("supabase/migrations/")) &&
    path.endsWith(".sql")
  ) {
    return sqlModelTokens.test(changedContent(path))
  }

  if (path.startsWith("scripts/") && /(?:\.[cm]?[jt]sx?|\.py)$/.test(path)) {
    const content = changedContent(path)
    return applicationModelTokens.test(content) || importModelTokens.test(content)
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
      "Add the business reason and governing GitHub or migration reference to the contract change log.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

process.stdout.write(
  (changeSet.committed ? "Compared committed changes; uncommitted files are outside this comparison.\n" : "Compared working-tree changes against HEAD, including untracked files.\n") +
  (relevant.length > 0
    ? `M&A data contract is synchronized with ${relevant.length} relevant changed file(s).\n`
    : "No M&A data contract update is required for the detected changes.\n"),
)
