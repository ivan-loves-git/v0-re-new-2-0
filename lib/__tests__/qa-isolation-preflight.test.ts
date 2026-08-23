import { describe, expect, it } from "vitest"
import {
  validateBranchReconstructionEvidence,
  validateIsolationPreflight,
} from "@/lib/qa/isolation-preflight.mjs"

const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const PREVIEW_REF = "ypzrsrykirpqerfpozdm"
const VALIDATION_ORIGIN = "https://renew-qa-pilot.example.vercel.app"

function validInput() {
  return {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PREVIEW_REF}.supabase.co`,
      DATABASE_URL: `postgresql://postgres.${PREVIEW_REF}:redacted@aws-0-eu-central-2.pooler.supabase.com:6543/postgres`,
      BETTER_AUTH_URL: VALIDATION_ORIGIN,
      NEXT_PUBLIC_APP_URL: VALIDATION_ORIGIN,
      QA_BROWSER_BASE_URL: VALIDATION_ORIGIN,
      QA_VALIDATION_ORIGIN: VALIDATION_ORIGIN,
      QA_SUPABASE_PROJECT_REF: PREVIEW_REF,
      QA_RUN_ID: "20260821-phase-a",
      QA_FIXTURE_PREFIX: "TEST-20260821-phase-a",
      QA_EMAIL_RECIPIENT: "delivered@resend.dev",
    },
    evidence: {
      supabase: {
        databaseRef: PREVIEW_REF,
        apiRef: PREVIEW_REF,
        storageRef: PREVIEW_REF,
      },
      vercel: {
        projectName: "renew-overnight-validation-20260820",
        target: null,
        aliases: ["renew-qa-pilot.example.vercel.app"],
        productionEnvironmentAttached: false,
      },
      email: {
        allowedRecipients: ["delivered@resend.dev"],
        applicationPolicy: "allowlist",
        applicationTransport: "simulated",
      },
    },
    manifest: {
      runId: "20260821-phase-a",
      fixturePrefix: "TEST-20260821-phase-a",
      databaseRows: [
        {
          table: "user",
          id: "TEST-20260821-phase-a-user",
          label: "TEST-20260821-phase-a",
        },
        {
          table: "repreneurs",
          id: "10000000-0000-4000-8000-000000000001",
          label: "TEST-20260821-phase-a",
        },
      ],
      betterAuthIdentities: ["TEST-20260821-phase-a-user"],
      storageObjects: ["TEST-20260821-phase-a/cvs/probe.pdf"],
      singletonSnapshots: [{ table: "wave_journey_settings", key: "true" }],
    },
  }
}

function expectFailure(mutator: (input: ReturnType<typeof validInput>) => void, code: string) {
  const input = validInput()
  mutator(input)
  expect(() => validateIsolationPreflight(input)).toThrow(`Isolation preflight failed: ${code}`)
}

describe("QA isolation preflight", () => {
  it("accepts only the authorised data-less persistent child branch for reconstruction", () => {
    const evidence = {
      projectRef: PREVIEW_REF,
      parentProjectRef: PRODUCTION_REF,
      isDefault: false,
      persistent: true,
      withData: false,
      status: "FUNCTIONS_DEPLOYED",
      previewProjectStatus: "ACTIVE_HEALTHY",
    }
    expect(validateBranchReconstructionEvidence(evidence, PREVIEW_REF)).toEqual({
      projectRef: PREVIEW_REF,
    })

    expect(validateBranchReconstructionEvidence(
      { ...evidence, status: "MIGRATIONS_FAILED" },
      PREVIEW_REF,
      { allowInitialMigrationFailure: true },
    )).toEqual({ projectRef: PREVIEW_REF })

    expect(() => validateBranchReconstructionEvidence(
      { ...evidence, status: "MIGRATIONS_FAILED" },
      PREVIEW_REF,
    )).toThrow("Isolation preflight failed: branch-evidence")
    for (const mutation of [
      { projectRef: "otherrefotherrefothe" },
      { parentProjectRef: "otherrefotherrefothe" },
      { isDefault: true },
      { persistent: false },
      { withData: true },
      { status: "MIGRATIONS_FAILED" },
      { previewProjectStatus: "INACTIVE" },
    ]) {
      expect(() =>
        validateBranchReconstructionEvidence({ ...evidence, ...mutation }, PREVIEW_REF),
      ).toThrow("Isolation preflight failed: branch-evidence")
    }
  })

  it("accepts one internally consistent non-production validation system", () => {
    expect(validateIsolationPreflight(validInput())).toEqual({
      projectRef: PREVIEW_REF,
      origin: VALIDATION_ORIGIN,
      runId: "20260821-phase-a",
    })
  })

  it("rejects an empty or production Supabase ref", () => {
    expectFailure((input) => {
      input.env.QA_SUPABASE_PROJECT_REF = ""
    }, "supabase-ref")
    expectFailure((input) => {
      input.env.QA_SUPABASE_PROJECT_REF = PRODUCTION_REF
      input.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_REF}.supabase.co`
    }, "supabase-ref")
  })

  it("rejects REST and Better Auth database identity mismatches", () => {
    expectFailure((input) => {
      input.env.DATABASE_URL = "postgresql://postgres.otherref:redacted@pooler.supabase.com:6543/postgres"
    }, "database-ref")
    expectFailure((input) => {
      input.env.DATABASE_URL = `postgresql://postgres.${PREVIEW_REF}:redacted@attacker.example.com:6543/postgres`
    }, "database-ref")
    expectFailure((input) => {
      input.env.DATABASE_URL = `https://postgres.${PREVIEW_REF}:redacted@aws-0-eu-central-2.pooler.supabase.com:6543/postgres`
    }, "database-ref")
  })

  it("requires equal HTTPS application, auth, browser, and approved origins", () => {
    expectFailure((input) => {
      input.env.QA_BROWSER_BASE_URL = "http://renew-qa-pilot.example.vercel.app"
    }, "validation-origin")
    expectFailure((input) => {
      input.env.BETTER_AUTH_URL = "https://another-preview.vercel.app"
    }, "validation-origin")
  })

  it("rejects every production or custom production alias", () => {
    for (const origin of [
      "https://app.re-new.team",
      "https://re-new.team",
      "https://v0-re-new-2-0.vercel.app",
    ]) {
      expectFailure((input) => {
        input.env.BETTER_AUTH_URL = origin
        input.env.NEXT_PUBLIC_APP_URL = origin
        input.env.QA_BROWSER_BASE_URL = origin
        input.env.QA_VALIDATION_ORIGIN = origin
      }, "production-origin")
    }
  })

  it("requires Database, API/Auth, and Storage probes to report the preview ref", () => {
    for (const probe of ["databaseRef", "apiRef", "storageRef"] as const) {
      expectFailure((input) => {
        input.evidence.supabase[probe] = PRODUCTION_REF
      }, "supabase-probes")
    }
  })

  it("requires the dedicated preview Vercel project without production attachment or aliases", () => {
    expectFailure((input) => {
      input.evidence.vercel.projectName = "v0-re-new-2-0"
    }, "vercel-project")
    expectFailure((input) => {
      input.evidence.vercel.target = "preview"
    }, "vercel-target")
    expectFailure((input) => {
      input.evidence.vercel.target = "production"
    }, "vercel-target")
    expectFailure((input) => {
      input.evidence.vercel.productionEnvironmentAttached = true
    }, "vercel-production-environment")
    expectFailure((input) => {
      input.evidence.vercel.aliases = ["app.re-new.team"]
    }, "vercel-alias")
  })

  it("permits only a Resend designated test recipient or QA-owned inbox", () => {
    expectFailure((input) => {
      input.env.QA_EMAIL_RECIPIENT = "customer@example.com"
    }, "email-recipient")
    expectFailure((input) => {
      input.evidence.email.allowedRecipients = ["customer@example.com"]
    }, "email-recipient")
  })

  it("requires exact TEST-run naming and a complete pre-creation fixture manifest", () => {
    expectFailure((input) => {
      input.env.QA_FIXTURE_PREFIX = "test-20260821-phase-a"
    }, "fixture-prefix")
    expectFailure((input) => {
      input.manifest.fixturePrefix = "TEST-other-run"
    }, "fixture-manifest")
    expectFailure((input) => {
      input.manifest.databaseRows = []
    }, "fixture-manifest")
    expectFailure((input) => {
      input.manifest.betterAuthIdentities = []
    }, "fixture-manifest")
    expectFailure((input) => {
      input.manifest.storageObjects = []
    }, "fixture-manifest")
  })
})
