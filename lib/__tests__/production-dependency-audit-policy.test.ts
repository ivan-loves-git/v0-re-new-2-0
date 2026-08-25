import { describe, expect, it } from "vitest"
import {
  assertProductionAudit,
  collectProductionAuditFindings,
} from "../../scripts/verify-production-dependency-audit.mjs"

const now = new Date("2026-08-25T00:00:00Z")
const policy = (exceptions: Array<Record<string, string>> = []) => ({
  minimumSeverity: "high",
  exceptions,
})

describe("production dependency audit policy", () => {
  it("preserves every pnpm advisory and installed path", () => {
    const findings = collectProductionAuditFindings({
      advisories: {
        first: {
          module_name: "shared-module",
          github_advisory_id: "GHSA-first",
          severity: "high",
          findings: [{ paths: ["root>one", "root>two"] }],
        },
        second: {
          module_name: "shared-module",
          github_advisory_id: "GHSA-second",
          severity: "high",
          findings: [{ paths: ["root>one"] }],
        },
      },
    })

    expect(findings).toHaveLength(3)
    expect(findings).toContainEqual({
      packageName: "shared-module",
      advisoryId: "GHSA-second",
      severity: "high",
      path: "root>one",
    })
  })

  it("fails an unapproved High or Critical advisory", () => {
    const audit = {
      advisories: {
        critical: {
          module_name: "critical-module",
          severity: "critical",
          findings: [{ paths: ["root>critical-module"] }],
        },
      },
    }
    expect(() => assertProductionAudit(audit, policy(), now)).toThrow(
      "production-dependency-audit-failed",
    )
  })

  it("allows Moderate-only results", () => {
    const audit = {
      advisories: {
        moderate: {
          module_name: "moderate-module",
          severity: "moderate",
          findings: [{ paths: ["root>moderate-module"] }],
        },
      },
    }
    expect(() => assertProductionAudit(audit, policy(), now)).not.toThrow()
  })

  it("supports the modern npm audit container", () => {
    const findings = collectProductionAuditFindings({
      vulnerabilities: {
        modern: {
          severity: "high",
          via: [{ source: 123 }, { github_advisory_id: "GHSA-modern" }],
          nodes: ["node_modules/modern"],
        },
      },
    })
    expect(findings).toHaveLength(2)
  })

  it("honors only exact, owned, unexpired exceptions", () => {
    const audit = {
      advisories: {
        allowed: {
          module_name: "shared-module",
          github_advisory_id: "GHSA-allowed",
          severity: "high",
          findings: [{ paths: ["root>shared-module"] }],
        },
      },
    }
    const exception = {
      package: "shared-module",
      advisory: "GHSA-allowed",
      owner: "Dev team",
      reason: "fixture",
      expiresAt: "2026-08-26",
    }
    expect(() => assertProductionAudit(audit, policy([exception]), now)).not.toThrow()
    expect(() => assertProductionAudit(audit, policy([{ ...exception, expiresAt: "2026-08-24" }]), now)).toThrow()
  })

  it("fails closed for malformed or registry-error payloads", () => {
    expect(() => assertProductionAudit({}, policy(), now)).toThrow(
      "production-dependency-audit-invalid",
    )
    expect(() => assertProductionAudit({ error: "registry" }, policy(), now)).toThrow(
      "production-dependency-audit-invalid",
    )
  })
})
