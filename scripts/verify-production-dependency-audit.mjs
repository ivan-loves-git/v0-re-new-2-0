import { readFile } from "node:fs/promises"

const severityRank = { low: 1, moderate: 2, medium: 2, high: 3, critical: 4 }

function invalid() {
  throw new Error("production-dependency-audit-invalid")
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null
}

function pathsFor(entry) {
  const findings = Array.isArray(entry.findings) ? entry.findings : []
  const paths = findings.flatMap((finding) => Array.isArray(finding?.paths) ? finding.paths : [])
  if (Array.isArray(entry.nodes)) paths.push(...entry.nodes)
  return paths.length ? [...new Set(paths.map((path) => String(path)))] : ["(path-unreported)"]
}

function legacyFindings(advisories) {
  const findings = []
  for (const [advisoryId, value] of Object.entries(advisories)) {
    const entry = asRecord(value)
    const packageName = entry?.module_name ?? entry?.module ?? entry?.name
    if (!entry || typeof packageName !== "string" || !packageName || typeof entry.severity !== "string" || !severityRank[entry.severity]) invalid()
    for (const path of pathsFor(entry)) {
      findings.push({ packageName, advisoryId: String(entry.github_advisory_id ?? entry.id ?? advisoryId), severity: entry.severity, path })
    }
  }
  return findings
}

function modernFindings(vulnerabilities) {
  const findings = []
  for (const [packageName, value] of Object.entries(vulnerabilities)) {
    const entry = asRecord(value)
    if (!entry || typeof entry.severity !== "string" || !severityRank[entry.severity] || !Array.isArray(entry.via)) invalid()
    const advisories = entry.via.map((via) => {
      if (typeof via === "string" && via) return via
      const advisory = asRecord(via)
      const id = advisory?.source ?? advisory?.id ?? advisory?.github_advisory_id ?? advisory?.name
      if (!advisory || (typeof id !== "string" && typeof id !== "number")) invalid()
      return String(id)
    })
    if (!advisories.length) invalid()
    for (const advisoryId of advisories) {
      for (const path of pathsFor(entry)) findings.push({ packageName, advisoryId, severity: entry.severity, path })
    }
  }
  return findings
}

export function collectProductionAuditFindings(audit) {
  if (!asRecord(audit) || audit.error) invalid()
  const advisories = asRecord(audit.advisories)
  const vulnerabilities = asRecord(audit.vulnerabilities)
  if (!advisories && !vulnerabilities) invalid()
  return [
    ...(advisories ? legacyFindings(advisories) : []),
    ...(vulnerabilities ? modernFindings(vulnerabilities) : []),
  ]
}

function isApproved(finding, exceptions, now) {
  return exceptions.some((exception) => {
    const expiresAt = typeof exception?.expiresAt === "string" ? new Date(`${exception.expiresAt}T23:59:59.999Z`) : new Date(NaN)
    return exception?.package === finding.packageName && exception?.advisory === finding.advisoryId &&
      typeof exception?.owner === "string" && exception.owner && typeof exception?.reason === "string" && exception.reason &&
      !Number.isNaN(expiresAt.valueOf()) && expiresAt >= now
  })
}

export function assertProductionAudit(audit, policy, now = new Date()) {
  const minimum = severityRank[policy?.minimumSeverity]
  if (!minimum || !Array.isArray(policy?.exceptions)) throw new Error("dependency-audit-policy-invalid")
  const violations = collectProductionAuditFindings(audit)
    .filter((finding) => (severityRank[finding.severity] ?? 0) >= minimum)
    .filter((finding) => !isApproved(finding, policy.exceptions, now))
    .map((finding) => `${finding.packageName}:${finding.severity}:${finding.advisoryId}:${finding.path}`)
  if (violations.length) throw new Error(`production-dependency-audit-failed:${violations.join(",")}`)
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [auditPath, policyPath = "scripts/production-dependency-audit-policy.json"] = process.argv.slice(2)
  if (!auditPath) throw new Error("dependency-audit-input-required")
  const [audit, policy] = await Promise.all([auditPath, policyPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))))
  assertProductionAudit(audit, policy)
}
