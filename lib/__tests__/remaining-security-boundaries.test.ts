import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  plainTextToSafeHtml,
  sanitizePublicHtml,
} from "@/lib/security/sanitize-html"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

function functionSource(relativePath: string, functionName: string) {
  const fileSource = source(relativePath)
  const start = fileSource.indexOf(`export async function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextExport = fileSource.indexOf("\nexport async function", start + 1)
  return fileSource.slice(
    start,
    nextExport === -1 ? fileSource.length : nextExport,
  )
}

function expectStaffBeforeAdmin(relativePath: string, functionName: string) {
  const functionBody = functionSource(relativePath, functionName)
  expect(functionBody.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
  const adminClient = functionBody.indexOf("createAdminClient")
  if (adminClient >= 0) {
    expect(functionBody.indexOf("requireStaffAccess")).toBeLessThan(adminClient)
  }
}

describe("remaining security boundaries", () => {
  it("keeps Better Auth invitation-only with database-backed rate limits", () => {
    const authSource = source("lib/auth.ts")
    const authRouteSource = source("app/api/auth/[...all]/route.ts")
    const rateLimitMigration = source(
      "scripts/065_fix_better_auth_rate_limit_id.sql",
    )
    expect(authSource).toMatch(/disableSignUp:\s*true/)
    expect(authSource).toMatch(/rateLimit:\s*{[\s\S]*enabled:\s*true/)
    expect(authSource).toMatch(/storage:\s*"database"/)
    expect(authSource).not.toMatch(/rateLimit:\s*{\s*enabled:\s*false/)
    expect(authRouteSource).toContain("consumeRequestRateLimit")
    expect(authRouteSource).toContain('"/api/auth/sign-in/email"')
    expect(authRouteSource).toContain("status: 429")
    expect(rateLimitMigration).toMatch(/ADD COLUMN IF NOT EXISTS id TEXT/)
    expect(rateLimitMigration).toMatch(
      /ALTER COLUMN id SET DEFAULT gen_random_uuid\(\)::TEXT/,
    )
    expect(rateLimitMigration).toMatch(/ALTER COLUMN id SET NOT NULL/)
    expect(rateLimitMigration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_id_uidx/,
    )
  })

  it("clears revoked sessions instead of looping at the routing gate", () => {
    const routingSource = functionSource(
      "lib/access-control.ts",
      "getPostLoginDestination",
    )
    expect(routingSource).toContain('if (!access) return "/auth/logout"')
    expect(routingSource).not.toContain('if (!access) return "/auth/login"')
  })

  it("invalidates pre-existing credentials before linking portal access", () => {
    const portalSource = functionSource(
      "lib/actions/portal-access.ts",
      "enableRepreneurPortalAccess",
    )
    const invalidation = portalSource.indexOf("invalidateCredentialAndSessions")
    const roleWrite = portalSource.indexOf("const roleWrite")
    expect(invalidation).toBeGreaterThanOrEqual(0)
    expect(invalidation).toBeLessThan(roleWrite)
  })

  it("requires staff access for offer, import, and assessment issuance", () => {
    for (const functionName of [
      "createOffer",
      "updateOffer",
      "toggleOfferActive",
      "assignOfferToRepreneur",
      "updateRepreneurOfferStatus",
      "deleteRepreneurOffer",
    ]) {
      expectStaffBeforeAdmin("lib/actions/offers.ts", functionName)
    }

    for (const functionName of [
      "previewOpportunityImport",
      "commitOpportunityImport",
    ]) {
      expectStaffBeforeAdmin("lib/actions/opportunity-import.ts", functionName)
    }

    expectStaffBeforeAdmin(
      "lib/actions/leadership-assessment.ts",
      "createAssessment",
    )
    expect(
      functionSource(
        "lib/actions/leadership-assessment.ts",
        "createAssessment",
      ),
    ).toContain("sent_by: user.id")
  })

  it("caps opportunity imports and rejects invalid approved indexes", () => {
    const importSource = source("lib/actions/opportunity-import.ts")
    expect(importSource).toContain("MAX_OPPORTUNITY_IMPORT_ROWS = 500")
    expect(importSource).toContain(
      "Approved indexes must reference imported rows",
    )
  })

  it("requires a consumed intake capability before parsing public uploads", () => {
    const uploadSource = functionSource("app/api/upload-cv/route.ts", "POST")
    expect(
      uploadSource.indexOf("verifyAndConsumeIntakeUploadToken"),
    ).toBeGreaterThanOrEqual(0)
    expect(
      uploadSource.indexOf("verifyAndConsumeIntakeUploadToken"),
    ).toBeLessThan(uploadSource.indexOf("request.formData"))
    expect(uploadSource).toContain("MAX_REQUEST_BYTES")
  })

  it("removes browser execution from the clipboard SECURITY DEFINER RPC", () => {
    const originalMigration = source(
      "supabase/migrations/20260513_add_scrapbook_upload_rpc.sql",
    )
    const correctiveMigration = source(
      "scripts/064_security_hardening_remaining.sql",
    )

    for (const migration of [originalMigration, correctiveMigration]) {
      expect(migration).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC/i)
      expect(migration).toMatch(/REVOKE ALL[\s\S]*FROM anon/i)
      expect(migration).toMatch(/REVOKE ALL[\s\S]*FROM authenticated/i)
    }
    expect(originalMigration).not.toMatch(/GRANT EXECUTE[\s\S]*TO anon/i)
    expect(originalMigration).not.toMatch(
      /GRANT EXECUTE[\s\S]*TO authenticated/i,
    )
  })

  it("sanitizes public clipboard HTML and escapes review text", () => {
    const unsafe =
      '<script>alert(1)</script><p onclick="alert(2)">Safe</p><a href="javascript:alert(3)">link</a>'
    const sanitized = sanitizePublicHtml(unsafe)
    expect(sanitized).not.toContain("<script")
    expect(sanitized).not.toContain("onclick")
    expect(sanitized).not.toContain("javascript:")
    expect(sanitized).toContain("<p>Safe</p>")

    const review = plainTextToSafeHtml("Hello <img src=x onerror=alert(1)>")
    expect(review).toContain("&lt;img")
    expect(review).not.toContain("<img")
  })

  it("keeps production E2E credentials out of tracked configuration", () => {
    const config = source("scripts/e2e-tests/config.ts")
    expect(config).toContain('requiredEnvironmentValue("E2E_TEST_EMAIL")')
    expect(config).toContain('requiredEnvironmentValue("E2E_TEST_PASSWORD")')
    expect(config).not.toMatch(/password:\s*"[^\n"]+"/)
  })
})
