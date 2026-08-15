import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function functionSource(relativePath: string, functionName: string) {
  const source = readFileSync(`${platformRoot}/${relativePath}`, "utf8")
  const start = source.indexOf(`export async function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextExport = source.indexOf("\nexport async function", start + 1)
  return source.slice(start, nextExport === -1 ? source.length : nextExport)
}

describe("high-severity authorization boundaries", () => {
  it("requires staff access before opportunity reads, closures, and retired shortcuts", () => {
    for (const functionName of [
      "listOpportunities",
      "listOpportunityWorkSurfaceRecords",
      "getOpportunity",
      "createOpportunityFromDraft",
      "closeOpportunity",
      "reopenOpportunity",
      "archiveOpportunity",
    ]) {
      const source = functionSource(
        "lib/actions/opportunities.ts",
        functionName,
      )
      expect(source.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
      const clientIndex = source.indexOf("createAdminClient")
      if (clientIndex >= 0) {
        expect(source.indexOf("requireStaffAccess")).toBeLessThan(clientIndex)
      }
    }
  })

  it("requires staff access before canonical intake and office-contact actions", () => {
    for (const functionName of [
      "listMaOfficeIntakeOptions",
      "listMaCanonicalContactOptions",
      "createOpportunityIntake",
      "updateOpportunityIntake",
      "createMaFirmOfficeContext",
      "createMaOfficeForExistingFirm",
      "createMaOfficeContact",
    ]) {
      const source = functionSource(
        "lib/actions/opportunity-intake.ts",
        functionName,
      )
      expect(source.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
      expect(source.indexOf("requireStaffAccess")).toBeLessThan(
        source.indexOf("createAdminClient"),
      )
    }
  })

  it("requires staff access before document storage and database operations", () => {
    for (const functionName of [
      "listOpportunityDocuments",
      "registerOpportunityDocument",
      "updateOpportunityDocumentVisibility",
      "removeOpportunityDocument",
    ]) {
      const source = functionSource(
        "lib/actions/opportunity-documents.ts",
        functionName,
      )
      expect(source.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
      expect(source.indexOf("requireStaffAccess")).toBeLessThan(
        source.indexOf("createAdminClient"),
      )
    }
  })

  it("requires staff access before email data or send operations", () => {
    for (const functionName of [
      "getRepreneursForManualSend",
      "sendManualEmail",
      "sendTestEmail",
    ]) {
      const source = functionSource("lib/actions/emails.ts", functionName)
      expect(source.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
      expect(source.indexOf("requireStaffAccess")).toBeLessThan(
        Math.max(
          source.indexOf("createAdminClient"),
          source.indexOf("sendEmailDirect"),
        ),
      )
    }
  })

  it("requires staff access before correcting another repreneur's target thesis", () => {
    const source = functionSource("lib/actions/repreneur-profile.ts", "updateRepreneurTargetThesis")
    expect(source).toContain("requireStaffAccess")
    expect(source).toContain("updateTargetThesisForRepreneur")
  })

  it("keeps the SQL role and CRM policies closed to browser API roles", () => {
    const repreneurMigration = readFileSync(
      `${platformRoot}/scripts/029_fix_rls_policies.sql`,
      "utf8",
    )
    const roleMigration = readFileSync(
      `${platformRoot}/scripts/047_create_app_user_roles.sql`,
      "utf8",
    )
    const correctiveMigration = readFileSync(
      `${platformRoot}/scripts/063_security_hardening_authorization.sql`,
      "utf8",
    )

    expect(repreneurMigration).not.toMatch(/USING\s*\(true\)/i)
    expect(repreneurMigration).not.toMatch(/WITH CHECK\s*\(true\)/i)
    expect(roleMigration).not.toMatch(/USING\s*\(true\)/i)
    expect(roleMigration).not.toMatch(/WITH CHECK\s*\(true\)/i)
    expect(correctiveMigration).toContain(
      'DROP POLICY IF EXISTS "Allow authenticated users to read repreneurs"',
    )
    expect(correctiveMigration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can view all repreneurs"',
    )
    expect(correctiveMigration).toContain(
      'DROP POLICY IF EXISTS "authenticated_read_all"',
    )
    expect(correctiveMigration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can view app user roles"',
    )
  })
})
