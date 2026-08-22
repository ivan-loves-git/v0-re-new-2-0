import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  assertSafeQaRuntime,
  buildFixtureManifest,
  validateLiveEvidence,
} from "@/lib/qa/phase-b.mjs"

const REF = "ypzrsrykirpqerfpozdm"
const SHA = "a".repeat(40)
const ORIGIN = "https://renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app"
const FINGERPRINT = "b".repeat(64)

function contractEvidence() {
  return {
    candidateContract: { expectedStructureFingerprint: FINGERPRINT },
    deployedContract: {
      candidateSha: SHA,
      projectRef: REF,
      apiRef: REF,
      databaseRef: REF,
      storageRef: REF,
      structureFingerprint: FINGERPRINT,
      validationProject: "renew-overnight-validation-20260820",
      mailPolicy: "allowlist",
      mailTransport: "simulated",
    },
  }
}

describe("Phase B QA contracts", () => {
  it("builds deterministic exact-ID fixtures with a run-scoped TEST prefix", () => {
    const first = buildFixtureManifest("32530000000-1")
    const second = buildFixtureManifest("32530000000-1")
    expect(first).toEqual(second)
    expect(first.fixturePrefix).toBe("TEST-32530000000-1")
    expect(first.databaseRows.length).toBeGreaterThanOrEqual(10)
    expect(first.databaseRows.every((row: { label: string }) => row.label === first.fixturePrefix)).toBe(true)
    expect(first.betterAuthIdentities).toHaveLength(2)
    expect(first.actors.staff.email).toBe(first.actors.staff.email.toLowerCase())
    expect(first.actors.portal.email).toBe(first.actors.portal.email.toLowerCase())
    expect(first.storageObjects).toEqual([`${first.fixturePrefix}/fixtures/pilot.pdf`])
    expect(first.ids.provisionalFirm).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.ids.provisionalContextContact).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.databaseRows.some((row: { id: string }) => row.id === first.ids.provisionalContext)).toBe(false)
    expect(first.singletonSnapshots).toContainEqual({ table: "ma_provisional_source_contexts", key: first.ids.provisionalContext })
  })

  it("accepts only live zero-state evidence from the exact protected deployment SHA", () => {
    expect(validateLiveEvidence({
      expectedRef: REF,
      expectedOrigin: ORIGIN,
      expectedSha: SHA,
      evidence: {
        ...contractEvidence(),
        collectedAt: "2026-08-21T21:00:00.000Z",
        supabase: {
          databaseRef: REF,
          apiRef: REF,
          storageRef: REF,
          databaseHealthy: true,
          restHealthy: true,
          authHealthy: true,
          storageHealthy: true,
          storageBuckets: [{ id: "cvs", public: false }, { id: "opportunity-documents", public: false }],
          customerRows: 0,
          applicationRows: 0,
          betterAuthUsers: 0,
          supabaseAuthUsers: 0,
          storageObjects: 0,
        },
        vercel: {
          projectName: "renew-overnight-validation-20260820",
          target: "preview",
          origin: ORIGIN,
          deploymentSha: SHA,
          protection: { unauthenticatedBlocked: true, authorizedStatus: 200 },
          aliases: [new URL(ORIGIN).hostname],
          productionEnvironmentAttached: false,
        },
      },
    })).toEqual({ projectRef: REF, origin: ORIGIN, deploymentSha: SHA })
  })

  it("fails closed on non-zero state, wrong SHA, or missing protection proof", () => {
    const base = {
      ...contractEvidence(),
      collectedAt: "2026-08-21T21:00:00.000Z",
      supabase: {
        databaseRef: REF, apiRef: REF, storageRef: REF,
        databaseHealthy: true, restHealthy: true, authHealthy: true, storageHealthy: true,
        storageBuckets: [{ id: "cvs", public: false }, { id: "opportunity-documents", public: false }],
        customerRows: 0, applicationRows: 0, betterAuthUsers: 0, supabaseAuthUsers: 0, storageObjects: 0,
      },
      vercel: {
        projectName: "renew-overnight-validation-20260820", target: "preview", origin: ORIGIN,
        deploymentSha: SHA, protection: { unauthenticatedBlocked: true, authorizedStatus: 200 },
        aliases: [new URL(ORIGIN).hostname], productionEnvironmentAttached: false,
      },
    }
    expect(() => validateLiveEvidence({ expectedRef: REF, expectedOrigin: ORIGIN, expectedSha: SHA, evidence: { ...base, supabase: { ...base.supabase, customerRows: 1, applicationRows: 1 } } })).toThrow("Live QA evidence failed: non-empty")
    expect(() => validateLiveEvidence({ expectedRef: REF, expectedOrigin: ORIGIN, expectedSha: SHA, evidence: { ...base, supabase: { ...base.supabase, storageBuckets: [{ id: "cvs", public: true }] } } })).toThrow("Live QA evidence failed: storage-buckets")
    expect(validateLiveEvidence({ expectedRef: REF, expectedOrigin: ORIGIN, expectedSha: SHA, evidence: { ...base, supabase: { ...base.supabase, customerRows: 1, applicationRows: 1 } }, allowStaleResidue: true })).toEqual({ projectRef: REF, origin: ORIGIN, deploymentSha: SHA })
    expect(() => validateLiveEvidence({ expectedRef: REF, expectedOrigin: ORIGIN, expectedSha: "b".repeat(40), evidence: base })).toThrow("Live QA evidence failed: deployment-sha")
    expect(() => validateLiveEvidence({ expectedRef: REF, expectedOrigin: ORIGIN, expectedSha: SHA, evidence: { ...base, vercel: { ...base.vercel, protection: { unauthenticatedBlocked: false, authorizedStatus: 200 } } } })).toThrow("Live QA evidence failed: deployment-protection")
  })

  it("rejects production or mismatched provider URLs before any cleanup connection", () => {
    const safe = {
      QA_SUPABASE_PROJECT_REF: REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
      DATABASE_URL: `postgresql://postgres.${REF}:redacted@aws-0-eu-central-2.pooler.supabase.com:6543/postgres`,
      QA_BROWSER_BASE_URL: ORIGIN,
      QA_VALIDATION_ORIGIN: ORIGIN,
    }
    expect(assertSafeQaRuntime(safe)).toEqual({ projectRef: REF, origin: ORIGIN })
    expect(() => assertSafeQaRuntime({ ...safe, QA_SUPABASE_PROJECT_REF: "iiuqcdnmxhtyispnykgf" })).toThrow("QA runtime isolation failed: project-ref")
    expect(() => assertSafeQaRuntime({ ...safe, DATABASE_URL: "postgresql://postgres.iiuqcdnmxhtyispnykgf:redacted@aws-0-eu-central-2.pooler.supabase.com:6543/postgres" })).toThrow("QA runtime isolation failed: database-ref")
    expect(() => assertSafeQaRuntime({ ...safe, QA_BROWSER_BASE_URL: "https://app.re-new.team", QA_VALIDATION_ORIGIN: "https://app.re-new.team" })).toThrow("QA runtime isolation failed: origin")
  })

  it("rehearses the exact active-opportunity RPC inside a rollback-only savepoint", () => {
    const seedScript = readFileSync(`${process.cwd()}/scripts/qa/seed-phase-b-fixtures.mjs`, "utf8")
    expect(seedScript).not.toContain("pg_get_functiondef")
    const commonScript = readFileSync(`${process.cwd()}/scripts/qa/phase-b-common.mjs`, "utf8")
    expect(commonScript).toContain("guard_ma_provisional_acme_firm_identity")
    expect(seedScript).toContain("setProvisionalIdentityTriggers(database, true)")
    expect(seedScript).toContain('NOTIFY pgrst, \'reload schema\'')
    expect(seedScript).toContain("SAVEPOINT phase_b_opportunity_probe")
    expect(seedScript).toContain("create_opportunity_with_office_context")
    expect(seedScript).toContain('      "",\n      ids.office,')
    expect(seedScript).toContain("ROLLBACK TO SAVEPOINT phase_b_opportunity_probe")
    expect(seedScript).toContain("/rest/v1/rpc/create_opportunity_with_office_context")
    expect(seedScript).toContain("DELETE FROM public.opportunity_mandate_reference_counters WHERE reference_code = $1")
  })

  it("records and removes the REST opportunity probe before deleting its parent row", () => {
    const seedScript = readFileSync(`${process.cwd()}/scripts/qa/seed-phase-b-fixtures.mjs`, "utf8")
    const cleanupScript = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    const recordProbe = seedScript.indexOf("recordRuntimeFixtures({ opportunityProbeId: restProbeBody.id })")
    const deleteProbeContacts = seedScript.indexOf("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = $1")
    const deleteProbe = seedScript.indexOf("DELETE FROM public.opportunities WHERE id = $1", deleteProbeContacts)

    expect(recordProbe).toBeGreaterThanOrEqual(0)
    expect(deleteProbeContacts).toBeGreaterThan(recordProbe)
    expect(deleteProbe).toBeGreaterThan(deleteProbeContacts)
    expect(cleanupScript).toContain("runtime.opportunityProbeId")
    expect(cleanupScript).toContain("`${manifest.fixturePrefix} opportunity probe`")
    expect(cleanupScript).toContain("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($1::uuid[])")
  })

  it("keeps the exact-candidate workflow private and cleans before artifacts", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const packageJson = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8"))
    expect(workflow).toContain("name: Golden journeys")
    expect(workflow).toContain("workflow_run:")
    expect(workflow).toContain("repository_dispatch:")
    expect(workflow).toContain("github.event.workflow_run.pull_requests[0].head.ref")
    expect(workflow).toContain("github.event.workflow_run.pull_requests[0].head.sha")
    expect(workflow).toContain("renew-permanent-qa")
    expect(workflow).not.toContain("pull_request_target")
    expect(workflow).toContain("environment: qa-pilot")
    expect(workflow).toContain("contents: write")
    expect(workflow).not.toContain("id-token: write")
    expect(packageJson.scripts["qa:browser:clean-run"]).toBe("node scripts/qa/verify-playwright-clean-run.mjs")
    expect(workflow.indexOf("Run P1-P3 in protected Chromium")).toBeLessThan(workflow.indexOf("Enforce first-attempt P1-P3 evidence"))
    expect(workflow.indexOf("Enforce first-attempt P1-P3 evidence")).toBeLessThan(workflow.indexOf("Read back exact persisted acceptance state"))
    const cleanup = workflow.indexOf("Cleanup exact manifest and label-owned fixtures")
    const upload = workflow.indexOf("Upload sanitized evidence")
    expect(cleanup).toBeGreaterThanOrEqual(0)
    expect(upload).toBeGreaterThan(cleanup)
    expect(workflow).toContain("retention-days: 1")
  })

  it("creates and finalizes the protected check on the exact candidate SHA", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const checkScript = readFileSync(`${process.cwd()}/scripts/qa/candidate-check.mjs`, "utf8")
    expect(workflow).toContain("node scripts/qa/candidate-check.mjs create")
    expect(workflow).toContain("node scripts/qa/candidate-check.mjs update")
    expect(checkScript).toContain('name: "P1-P3 protected pilot"')
    expect(checkScript).toContain("head_sha: sha")
    expect(readFileSync(`${process.cwd()}/scripts/qa/validate-candidate.mjs`, "utf8")).toContain("verifyRunId")
    expect(readFileSync(`${process.cwd()}/scripts/qa/validate-candidate.mjs`, "utf8")).toContain('app?.slug === "github-actions"')
    expect(workflow).not.toContain("Ignore unrelated deployment")
  })

  it("configures Chromium only with one CI retry and private artifacts", () => {
    const config = readFileSync(`${process.cwd()}/playwright.config.ts`, "utf8")
    expect(config).toContain("retries: process.env.CI ? 1 : 0")
    expect(config).toContain('name: "chromium"')
    expect(config).not.toContain("webkit")
    expect(config).not.toContain("firefox")
    expect(config).toContain('trace: "on-first-retry"')
    expect(config).toContain('screenshot: "only-on-failure"')
  })

  it("exposes non-secret immutable deployment provenance for pre-browser verification", () => {
    const config = readFileSync(`${process.cwd()}/next.config.mjs`, "utf8")
    expect(config).toContain('key: "x-renew-deployment-sha"')
    expect(config).toContain("gitCommitSha")
    expect(config).toContain("assertQaBuildEnv(process.env)")
  })
})
