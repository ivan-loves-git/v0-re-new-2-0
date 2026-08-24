import { readFile } from "node:fs/promises"

const severityRank = { low: 1, moderate: 2, medium: 2, high: 3, critical: 4 }

export function assertProductionAudit(audit, policy, now = new Date()) {
  if (!audit || typeof audit !== "object" || audit.error || !audit.vulnerabilities || typeof audit.vulnerabilities !== "object") {
    throw new Error("production-dependency-audit-invalid")
  }
  const minimum = severityRank[policy.minimumSeverity]
  if (!minimum || !Array.isArray(policy.exceptions)) throw new Error("dependency-audit-policy-invalid")

  const violations = []
  for (const [packageName, entry] of Object.entries(audit.vulnerabilities)) {
    const severity = severityRank[entry.severity] ?? 0
    if (severity < minimum) continue
    const advisories = (entry.via ?? []).flatMap((via) => typeof via === "object" && via ? [String(via.name)] : [])
    const allowed = policy.exceptions.some((exception) =>
      exception.package === packageName && advisories.includes(exception.advisory) &&
      exception.owner && exception.reason && new Date(`${exception.expiresAt}T23:59:59.999Z`) >= now,
    )
    if (!allowed) violations.push(`${packageName}:${entry.severity}`)
  }
  if (violations.length) throw new Error(`production-dependency-audit-failed:${violations.join(",")}`)
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [auditPath, policyPath = "scripts/production-dependency-audit-policy.json"] = process.argv.slice(2)
  if (!auditPath) throw new Error("dependency-audit-input-required")
  const [audit, policy] = await Promise.all([auditPath, policyPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))))
  assertProductionAudit(audit, policy)
}
