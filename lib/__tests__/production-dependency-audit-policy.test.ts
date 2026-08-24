import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { assertProductionAudit } from "../../scripts/verify-production-dependency-audit.mjs"

const audit = { vulnerabilities: { sharp: { severity: "high", via: [{ name: "GHSA-54xq-cgqr-r9vw" }] } } }
const policy = (path: string) => JSON.parse(readFileSync(`${process.cwd()}/${path}`, "utf8"))

describe("production dependency audit policy", () => {
  it("rejects an unapproved high-severity production advisory", () => {
    expect(() => assertProductionAudit(audit, policy("scripts/production-dependency-audit-policy.json"), new Date("2026-08-24T00:00:00Z"))).toThrow("production-dependency-audit-failed")
  })

  it("fails the controlled expired-exception fixture", () => {
    expect(() => assertProductionAudit(audit, policy("scripts/fixtures/production-audit-policy-expired.json"), new Date("2026-08-24T00:00:00Z"))).toThrow("production-dependency-audit-failed")
  })
})
