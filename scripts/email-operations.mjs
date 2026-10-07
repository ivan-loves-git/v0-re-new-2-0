import { PROJECT, sourceMatches } from "./email-operations/project.mjs"
import { inspectServices } from "./email-operations/preflight.mjs"
import { verifyRepreneurAccess } from "./email-operations/role.mjs"
import { verifyQaReceipt } from "./email-operations/receipt.mjs"
import { constants, closeSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { parseArgs, parseEnv } from "node:util"

/** @param {{command?: string, env?: Record<string, string | undefined>, browser?: string, execute?: boolean, qaRecipient?: string, reviewId?: string, fetchImpl?: typeof fetch}} [options] */
export async function runEmailOperations(options = {}) {
  const { env = process.env, command = "preflight", browser = "unspecified", fetchImpl = fetch } = options
  if (!["preflight", "receipt", "role"].includes(command) || !["Aside", "iab", "chrome", "edge", "unspecified"].includes(browser) || (options.execute && command !== "role")) {
    return { schema: 1, state: "invalid", reason: "unsupported_command_browser_or_execution", readOnly: true }
  }
  if (!sourceMatches(env)) {
    return { schema: 1, state: "blocked", reason: "source_project_mismatch", expectedProject: PROJECT.name, readOnly: true,
      source: { expected: PROJECT.sourceUrl, observed: "unrecognized_source", state: "mismatch" } }
  }
  if (command === "preflight") return inspectServices(env, browser, fetchImpl)
  if (command === "role") {
    if (!env.QA_REPRENEUR_EMAIL || !env.QA_REPRENEUR_PASSWORD || options.qaRecipient !== env.QA_REPRENEUR_EMAIL) {
      return { schema: 1, state: "blocked", reason: "explicit_owned_qa_identity_required", readOnly: true }
    }
    if (!options.execute) return { schema: 1, command, state: "requires_execution", readOnly: true, target: PROJECT.appOrigin }
    return verifyRepreneurAccess(env, fetchImpl)
  }
  if (command === "receipt") {
    if (!env.QA_PRIMARY_EMAIL || options.qaRecipient !== env.QA_PRIMARY_EMAIL ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(options.reviewId ?? "")) {
      return { schema: 1, state: "blocked", reason: "explicit_owned_qa_receipt_required", readOnly: true }
    }
    return verifyQaReceipt(env, options.reviewId, fetchImpl)
  }
}

const usage = `Usage: pnpm email:ops <preflight|receipt|role> [options]
  --env-file path           Explicit approved credential source; replaces inherited environment
  --vercel-auth-file path   Optional approved Vercel CLI auth file, kept in memory
  --browser Aside|iab|chrome|edge  Surface to inspect if API access is insufficient
  --qa-recipient address    Explicit configured owned QA identity
  --review-id uuid          Existing controlled sent QA review (receipt only)
  --execute                Create/close an owned QA session (role only)
  --json                   Compact non-secret result
  --evidence-file path      New private proof file outside the checkout; never overwrites
`

function saveEvidence(path, report) {
  const repository = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."))
  if (!isAbsolute(path)) throw new Error("absolute_evidence_path_required")
  const full = resolve(realpathSync(dirname(path)), path.split(sep).at(-1))
  const rel = relative(repository, full)
  if (!rel || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`))) throw new Error("private_evidence_must_be_outside_checkout")
  const file = openSync(full, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try { writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`) } finally { closeSync(file) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: {
      "env-file": { type: "string" }, "vercel-auth-file": { type: "string" },
      browser: { type: "string" }, "qa-recipient": { type: "string" }, "review-id": { type: "string" },
      execute: { type: "boolean" }, json: { type: "boolean" }, help: { type: "boolean" }, "evidence-file": { type: "string" },
    } })
    if (values.help) process.stdout.write(usage)
    else {
      if (positionals.length !== 1) throw new Error("one_command_required")
      const env = values["env-file"] ? parseEnv(readFileSync(values["env-file"], "utf8")) : { ...process.env }
      if (values["vercel-auth-file"]) {
        const auth = JSON.parse(readFileSync(values["vercel-auth-file"], "utf8"))
        if (typeof auth.token !== "string" || !auth.token) throw new Error("invalid_auth_source")
        env.VERCEL_TOKEN = auth.token
      }
      const report = await runEmailOperations({ command: positionals[0], env, browser: values.browser,
        qaRecipient: values["qa-recipient"], reviewId: values["review-id"], execute: values.execute })
      report.observedAt = new Date().toISOString()
      if (values["evidence-file"]) saveEvidence(values["evidence-file"], report)
      const services = report.command === "preflight" ? `; Resend=${report.resend.state}/${report.resend.access}; Vercel=${report.vercel.state}/${report.vercel.access}${report.vercel.fallback ? `; inspect ${report.vercel.fallback.browser} (session not observed)` : ""}` : ""
      process.stdout.write(values.json ? `${JSON.stringify(report)}\n`
        : `Email Operations ${positionals[0]}: ${report.state}${report.reason ? ` (${report.reason})` : ""}${services}; read-only=${report.readOnly}\n`)
      process.exitCode = report.state === "invalid" ? 2 : ["verified", "requires_execution"].includes(report.state) ? 0 : 1
    }
  } catch {
    process.stderr.write("Email Operations: invalid arguments, unavailable credential source or unsafe evidence destination. Use --help.\n")
    process.exitCode = 2
  }
}
