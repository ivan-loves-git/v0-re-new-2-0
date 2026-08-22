import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import {
  assertSafeQaRuntime,
  buildFixtureManifest,
  validateLiveEvidence,
} from "@/lib/qa/phase-b.mjs"

const REF = "ncsnoinizxwdcbarxzzl"
const SHA = "a".repeat(40)
const ORIGIN = "https://renew-overnight-validation-git-e43dfc-myworkmail4-pngs-projects.vercel.app"

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
    expect(first.databaseRows.some((row: { id: string }) => row.id === first.ids.provisionalContext)).toBe(true)
  })

  it("accepts only live zero-state evidence from the exact protected deployment SHA", () => {
    expect(validateLiveEvidence({
      expectedRef: REF,
      expectedOrigin: ORIGIN,
      expectedSha: SHA,
      evidence: {
        collectedAt: "2026-08-21T21:00:00.000Z",
        supabase: {
          databaseRef: REF,
          apiRef: REF,
          storageRef: REF,
          databaseHealthy: true,
          restHealthy: true,
          authHealthy: true,
          storageHealthy: true,
          customerRows: 0,
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
      collectedAt: "2026-08-21T21:00:00.000Z",
      supabase: {
        databaseRef: REF, apiRef: REF, storageRef: REF,
        databaseHealthy: true, restHealthy: true, authHealthy: true, storageHealthy: true,
        customerRows: 0, betterAuthUsers: 0, supabaseAuthUsers: 0, storageObjects: 0,
      },
      vercel: {
        projectName: "renew-overnight-validation-20260820", target: "preview", origin: ORIGIN,
        deploymentSha: SHA, protection: { unauthenticatedBlocked: true, authorizedStatus: 200 },
        aliases: [new URL(ORIGIN).hostname], productionEnvironmentAttached: false,
      },
    }
    expect(() => validateLiveEvidence({ expectedRef: REF, expectedOrigin: ORIGIN, expectedSha: SHA, evidence: { ...base, supabase: { ...base.supabase, customerRows: 1 } } })).toThrow("Live QA evidence failed: non-empty")
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
    expect(seedScript).toContain("pg_get_functiondef")
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

  it("keeps the advisory workflow private and cleans before artifacts", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    expect(workflow).toContain("name: Golden journeys")
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).toContain("deployment_status:")
    expect(workflow).toContain("Preview – renew-overnight-validation-20260820")
    expect(workflow).toContain("github.event.deployment.environment || github.ref")
    expect(workflow).not.toContain("pull_request_target")
    expect(workflow).toContain("environment: qa-pilot")
    expect(workflow).toContain("contents: read")
    expect(workflow).not.toContain("id-token: write")
    expect(workflow.indexOf("Cleanup exact fixtures")).toBeLessThan(workflow.indexOf("Upload sanitized evidence"))
    expect(workflow).toContain("retention-days: 1")
  })

  it("reserves the protected check name for manual or exact validation deployments", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const jobNameSource = workflow.match(/jobs:\n  pilot:\n    name: >-\n([\s\S]*?)\n    if: >-/)?.[1]

    expect(jobNameSource).toBeDefined()
    const expression = jobNameSource!
      .replace(/^\s*\$\{\{/, "")
      .replace(/\}\}\s*$/, "")
    const checkName = (github: object) => runInNewContext(expression, { github })
    const exactDeployment = {
      event_name: "deployment_status",
      event: {
        deployment_status: { state: "success" },
        deployment: {
          environment: "Preview – renew-overnight-validation-20260820",
          creator: { login: "vercel[bot]" },
        },
      },
    }

    expect(checkName({ event_name: "workflow_dispatch", event: {} })).toBe("P1-P3 protected pilot")
    expect(checkName(exactDeployment)).toBe("P1-P3 protected pilot")
    expect(checkName({
      ...exactDeployment,
      event: {
        ...exactDeployment.event,
        deployment: {
          ...exactDeployment.event.deployment,
          environment: "Production – v0-re-new-2-0",
        },
      },
    })).toBe("Ignore unrelated deployment")
    expect(checkName({
      ...exactDeployment,
      event: {
        ...exactDeployment.event,
        deployment_status: { state: "failure" },
      },
    })).toBe("Ignore unrelated deployment")
    expect(checkName({
      ...exactDeployment,
      event: {
        ...exactDeployment.event,
        deployment: {
          ...exactDeployment.event.deployment,
          creator: { login: "untrusted-user" },
        },
      },
    })).toBe("Ignore unrelated deployment")
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
  })
})
