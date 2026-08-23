#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process"
import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, join, relative, sep } from "node:path"
import { promisify } from "node:util"
import { CREDENTIALS_FILE, RUN_DIR, removeRunnerSecrets, writePrivateJson } from "./phase-b-common.mjs"

const execFile = promisify(execFileCallback)
const HTML_REPORT_DIR = join(RUN_DIR, "playwright-report")
const PLAYWRIGHT_RESULTS_FILE = join(RUN_DIR, "playwright-results.json")
const TRACE_ACTIONS_FILE = `${RUN_DIR}/sanitized-trace-actions.json`
const TRACE_SUMMARY_FILE = `${RUN_DIR}/sanitized-traces.json`
const secretEnvironmentName = /(?:^|_)(?:SECRET|TOKEN|PASSWORD|KEY|COOKIE)$|DATABASE_URL$|CONNECTION_(?:STRING|URL)$|^(?:NEXT_PUBLIC_SUPABASE_URL|BETTER_AUTH_URL|NEXT_PUBLIC_APP_URL|QA_BROWSER_BASE_URL|QA_VALIDATION_ORIGIN|QA_EMAIL_RECIPIENT)$/i
const sensitiveValues = Object.entries(process.env)
  .filter(([name, value]) => secretEnvironmentName.test(name) && typeof value === "string" && value.length > 0)
  .map(([, value]) => value)
  .sort((left, right) => right.length - left.length)
const forbiddenTraceResidue = /(?:https?:\/\/[^\s"']*\?|\b(?:cookie|set-cookie|authorization|password|passwd|token|storage.?state|connection(?:string|uri)|bearer\s+|postgres(?:ql)?:\/\/))/i
// Diagnostic-only classifiers. Pass/fail always uses forbiddenTraceResidue above; these must not
// introduce trailing word boundaries or otherwise narrow detection.
const RESIDUE_RULE_CATEGORIES = Object.freeze([
  Object.freeze({ category: "url-query", pattern: /https?:\/\/[^\s"']*\?/i }),
  Object.freeze({ category: "cookie", pattern: /\b(?:cookie|set-cookie)/i }),
  Object.freeze({ category: "authorization", pattern: /\bauthorization/i }),
  Object.freeze({ category: "password", pattern: /\b(?:password|passwd)/i }),
  Object.freeze({ category: "token", pattern: /\btoken/i }),
  Object.freeze({ category: "storage-state", pattern: /\bstorage.?state/i }),
  Object.freeze({ category: "connection-string", pattern: /\bconnection(?:string|uri)/i }),
  Object.freeze({ category: "bearer", pattern: /\bbearer\s+/i }),
  Object.freeze({ category: "postgres-uri", pattern: /\bpostgres(?:ql)?:\/\//i }),
])
const RESIDUE_CATEGORIES = new Set(RESIDUE_RULE_CATEGORIES.map((rule) => rule.category))

function classifyForbiddenResidueCategory(text) {
  if (!forbiddenTraceResidue.test(text)) return "unknown"
  for (const rule of RESIDUE_RULE_CATEGORIES) {
    if (rule.pattern.test(text)) return rule.category
  }
  return "unknown"
}

function safeRelativeRunPath(file) {
  const relativePath = relative(RUN_DIR, file)
  if (
    !relativePath ||
    relativePath.startsWith(`..${sep}`) ||
    relativePath === ".." ||
    relativePath.includes(`..${sep}`) ||
    relativePath.includes("\0") ||
    !/^[A-Za-z0-9._/-]+$/.test(relativePath)
  ) {
    return "untrusted-path"
  }
  return relativePath
}

function reportUnsafeTextResidue({ file, category }) {
  const rule = RESIDUE_CATEGORIES.has(category) ? category : "unknown"
  console.error(JSON.stringify({
    ok: false,
    code: "unsafe-text-residue",
    file: safeRelativeRunPath(file),
    rule,
  }))
}

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return (await Promise.all(entries.map(async (entry) => {
    const full = join(path, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  }))).flat()
}

function redactKnownSecrets(value) {
  let redacted = value
  for (const secret of sensitiveValues) redacted = redacted.split(secret).join("[REDACTED]")
  return redacted
}

function safeActionName(value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(value)) {
    throw new Error("unsafe-action-name")
  }
  return value
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function safeError(error) {
  if (!error) return undefined
  const rawName = typeof error.name === "string" ? error.name : "ActionError"
  const rawMessage = typeof error.message === "string" ? error.message : "Action failed"
  if (
    sensitiveValues.some((secret) => rawMessage.includes(secret)) ||
    forbiddenTraceResidue.test(rawMessage)
  ) {
    return {
      category: "SensitiveDataRedacted",
      message: "[REDACTED sensitive error]",
    }
  }
  return rawName === "TimeoutError"
    ? { category: "TimeoutError", message: "Action timed out" }
    : { category: "ActionError", message: "Action failed" }
}

function parseTraceActions(text) {
  const calls = new Map()
  const actions = []
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    const record = JSON.parse(rawLine)
    if (record?.type === "before" && typeof record.callId === "string") {
      const actionName = record.apiName || (
        typeof record.class === "string" && typeof record.method === "string"
          ? `${record.class}.${record.method}`
          : record.method
      )
      calls.set(record.callId, {
        action: safeActionName(actionName),
        startTimeMs: safeNumber(record.startTime),
      })
      continue
    }
    if (record?.type !== "after" || typeof record.callId !== "string") continue
    const before = calls.get(record.callId)
    if (!before || before.startTimeMs === undefined) throw new Error("unpaired-action")
    const endTimeMs = safeNumber(record.endTime)
    if (endTimeMs === undefined || endTimeMs < before.startTimeMs) throw new Error("invalid-action-time")
    const action = {
      order: actions.length + 1,
      action: before.action,
      startTimeMs: before.startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - before.startTimeMs,
    }
    const error = safeError(record.error)
    if (error) action.error = error
    actions.push(action)
    calls.delete(record.callId)
  }
  if (calls.size > 0) throw new Error("unpaired-action")
  return actions
}

async function extractTrace(archive, index) {
  const { stdout: listing } = await execFile("unzip", ["-Z1", archive], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
  const listedEntries = listing.split(/\r?\n/).filter(Boolean)
  const traceCandidates = listedEntries.filter((entry) => basename(entry).endsWith("trace.trace"))
  if (traceCandidates.some((entry) => !/^(?:\d+-)?trace\.trace$/.test(basename(entry)))) {
    throw new Error("unsafe-trace-log-name")
  }
  const entries = traceCandidates
  if (entries.length === 0) throw new Error("missing-trace-log")
  if (new Set(entries).size !== entries.length) throw new Error("duplicate-trace-log")
  const traceId = `trace-${String(index + 1).padStart(3, "0")}`
  const segments = await Promise.all(entries.map(async (entry, segmentIndex) => {
    const { stdout } = await execFile("unzip", ["-p", archive, entry], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
    return {
      segmentId: `${traceId}-segment-${String(segmentIndex + 1).padStart(3, "0")}`,
      actions: parseTraceActions(stdout),
    }
  }))
  return {
    traceId,
    segments,
  }
}

const generatedCredentials = await readFile(CREDENTIALS_FILE, "utf8")
  .then((text) => Object.values(JSON.parse(text)).filter((value) => typeof value === "string" && value.length > 0))
  .catch(() => [])
sensitiveValues.push(...generatedCredentials)
sensitiveValues.sort((left, right) => right.length - left.length)
await removeRunnerSecrets()
await rm(HTML_REPORT_DIR, { recursive: true, force: true })
await rm(PLAYWRIGHT_RESULTS_FILE, { force: true })
const files = await walk(RUN_DIR)
const traceArchives = files.filter((path) => path.endsWith(".zip")).sort()
let traces
try {
  traces = await Promise.all(traceArchives.map(extractTrace))
} catch {
  await Promise.all(traceArchives.map((archive) => rm(archive, { force: true })))
  await Promise.all([rm(TRACE_ACTIONS_FILE, { force: true }), rm(TRACE_SUMMARY_FILE, { force: true })])
  throw new Error("Artifact sanitization failed: trace-extraction")
}
await Promise.all(traceArchives.map((archive) => rm(archive, { force: true })))
const traceEvidence = { schemaVersion: 2, traces }
const serializedTraceEvidence = JSON.stringify(traceEvidence)
if (
  sensitiveValues.some((secret) => serializedTraceEvidence.includes(secret)) ||
  forbiddenTraceResidue.test(serializedTraceEvidence)
) {
  await Promise.all([rm(TRACE_ACTIONS_FILE, { force: true }), rm(TRACE_SUMMARY_FILE, { force: true })])
  throw new Error("Artifact sanitization failed: trace-residue")
}
await writePrivateJson(TRACE_ACTIONS_FILE, traceEvidence)
await writePrivateJson(TRACE_SUMMARY_FILE, {
  rawTraceArchivesRemoved: traceArchives.length,
  sanitizedActionTracesRetained: traces.length,
  sanitizedActionSegmentsRetained: traces.reduce((count, trace) => count + trace.segments.length, 0),
  sanitizedActionTraceFile: "sanitized-trace-actions.json",
  networkPayloadsRetained: false,
  sessionStateRetained: false,
  htmlReportRetained: false,
  htmlReportRemovalReason: "privacy",
  playwrightJsonReportRetained: false,
  playwrightJsonReportRemovalReason: "privacy",
  note: "Raw retry traces, the Playwright HTML report, and uncurated playwright-results.json are deleted; curated clean-run/case/cleanup/empty evidence and the sanitized action timeline are retained.",
})

for (const file of (await walk(RUN_DIR)).filter((path) => /\.(json|html|txt|trace)$/.test(path))) {
  let text = await readFile(file, "utf8")
  text = redactKnownSecrets(text)
  if (forbiddenTraceResidue.test(text)) {
    reportUnsafeTextResidue({ file, category: classifyForbiddenResidueCategory(text) })
    await rm(file, { force: true })
    throw new Error("Artifact sanitization failed: unsafe-text-residue")
  }
  await writeFile(file, text)
}

for (const file of await walk(RUN_DIR)) {
  if (!/\.(json|html|txt|trace|zip|png|jpg|jpeg|webp)$/.test(file)) await rm(file, { force: true })
}
const sanitizedFiles = await walk(RUN_DIR)
for (const file of sanitizedFiles) {
  if (/(credentials|storage.?state|\/auth\/|\.zip$)/i.test(file)) throw new Error("Artifact sanitization failed: forbidden-file")
  if (!/\.(json|html|txt|trace)$/.test(file)) continue
  const text = await readFile(file, "utf8")
  if (sensitiveValues.some((value) => text.includes(value))) throw new Error("Artifact sanitization failed: secret-residue")
}
console.log(JSON.stringify({ ok: true, sanitizedFiles: sanitizedFiles.length, rawTraceArchivesRemoved: traceArchives.length, sanitizedActionTracesRetained: traces.length, networkPayloadsRemoved: true, runnerSecretsRemoved: true }))
