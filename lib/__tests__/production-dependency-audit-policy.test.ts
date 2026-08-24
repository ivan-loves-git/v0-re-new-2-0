import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { assertProductionAudit, collectProductionAuditFindings } from "../../scripts/verify-production-dependency-audit.mjs"

const load = (path: string) => JSON.parse(readFileSync(`${process.cwd()}/${path}`, "utf8"))
const now = new Date("2026-08-24T00:00:00Z")
const policy = (exceptions: Array<Record<string, string>> = []) => ({ minimumSeverity: "high", exceptions })
const approved = (advisory: string) => ({ package: "shared-module", advisory, owner: "security", reason: "fixture", expiresAt: "2026-12-31" })

describe("production dependency audit policy", () => {
  it("uses pnpm module_name and preserves every advisory and installed path", () => {
    const findings = collectProductionAuditFindings(load("scripts/fixtures/production-audit-pnpm-module-name.json"))
    expect(findings).toEqual(expect.arrayContaining([
      { packageName: "shared-module", advisoryId: "GHSA-allowed", severity: "high", path: "root>one>shared-module" },
      { packageName: "shared-module", advisoryId: "GHSA-allowed", severity: "high", path: "root>two>shared-module" },
      { packageName: "shared-module", advisoryId: "GHSA-unapproved", severity: "high", path: "root>one>shared-module" },
    ]))
  })

  it("does not let an allowed advisory mask an unapproved high on the same module", () => {
    expect(() => assertProductionAudit(load("scripts/fixtures/production-audit-pnpm-module-name.json"), policy([approved("GHSA-allowed")]), now))
      .toThrow("shared-module:high:GHSA-unapproved:root>one>shared-module")
  })

  it("allows an active exception only when it matches the exact high advisory", () => {
    expect(() => assertProductionAudit(load("scripts/fixtures/production-audit-pnpm-module-name.json"), policy([
      approved("GHSA-allowed"), approved("GHSA-unapproved"),
    ]), now)).not.toThrow()
  })

  it("preserves every modern advisory and installed path", () => {
    const findings = collectProductionAuditFindings(load("scripts/fixtures/production-audit-modern-vulnerabilities.json"))
    expect(findings).toHaveLength(4)
    expect(findings).toEqual(expect.arrayContaining([
      { packageName: "modern-module", advisoryId: "1099999", severity: "high", path: "node_modules/modern-module" },
      { packageName: "modern-module", advisoryId: "GHSA-modern", severity: "high", path: "node_modules/other/node_modules/modern-module" },
    ]))
  })

  it("allows Moderate-only audit results", () => {
    expect(() => assertProductionAudit(load("scripts/fixtures/production-audit-moderate-only.json"), policy(), now)).not.toThrow()
  })

  it("accepts an explicit empty audit container but rejects unknown severities", () => {
    expect(() => assertProductionAudit({ advisories: {}, metadata: { vulnerabilities: {} } }, policy(), now)).not.toThrow()
    expect(() => assertProductionAudit({ advisories: { bad: { module_name: "x", severity: "unknown" } } }, policy(), now)).toThrow("production-dependency-audit-invalid")
  })

  it("does not honor an expired exception", () => {
    const audit = { vulnerabilities: { sharp: { severity: "high", via: [{ name: "GHSA-expired" }], nodes: ["node_modules/sharp"] } } }
    const expired = { minimumSeverity: "high", exceptions: [{ package: "sharp", advisory: "GHSA-expired", owner: "security", reason: "fixture", expiresAt: "2026-08-01" }] }
    expect(() => assertProductionAudit(audit, expired, now)).toThrow("production-dependency-audit-failed")
  })

  it("fails an unapproved Critical advisory", () => {
    const audit = { advisories: { "GHSA-critical": { module_name: "critical-module", severity: "critical", findings: [{ paths: ["root>critical-module"] }] } } }
    expect(() => assertProductionAudit(audit, policy(), now)).toThrow("critical-module:critical:GHSA-critical:root>critical-module")
  })

  it("fails closed for malformed or audit-error payloads", () => {
    expect(() => assertProductionAudit({ error: "registry" }, policy(), now)).toThrow("production-dependency-audit-invalid")
    expect(() => assertProductionAudit({}, policy(), now)).toThrow("production-dependency-audit-invalid")
    expect(() => assertProductionAudit({ advisories: { bad: { module_name: "x" } } }, policy(), now)).toThrow("production-dependency-audit-invalid")
    expect(() => assertProductionAudit({ vulnerabilities: { bad: { severity: "high", via: [] } } }, policy(), now)).toThrow("production-dependency-audit-invalid")
  })
})
