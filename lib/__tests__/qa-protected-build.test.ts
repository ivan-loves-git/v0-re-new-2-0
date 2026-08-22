import { describe, expect, it } from "vitest"
import { assertQaBuildEnv } from "@/lib/qa/protected-build.mjs"

const REF = "pihqnxwougxartvhkelv"
const safe = {
  QA_CONTRACT_MODE: "protected",
  QA_SUPABASE_PROJECT_REF: REF,
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${REF}:***@aws-0-eu-central-2.pooler.supabase.com:6543/postgres`,
  QA_MAIL_MODE: "allowlist",
  QA_MAIL_TRANSPORT: "simulated",
  VERCEL_PROJECT_NAME: "renew-overnight-validation-20260820",
  VERCEL_PROJECT_ID: "prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y",
}

describe("protected QA build contract", () => {
  it("rejects the validation project ID when protected mode is missing", () => {
    expect(() => assertQaBuildEnv({
      VERCEL_PROJECT_NAME: "some-other-project-name",
      VERCEL_PROJECT_ID: safe.VERCEL_PROJECT_ID,
    })).toThrow("Protected QA build failed: contract-mode")
  })

  it("rejects the validation project name when protected mode is missing", () => {
    expect(() => assertQaBuildEnv({
      VERCEL_PROJECT_NAME: safe.VERCEL_PROJECT_NAME,
      VERCEL_PROJECT_ID: "prj_other",
    })).toThrow("Protected QA build failed: contract-mode")
  })

  it("rejects protected mode with the wrong Vercel project ID or name", () => {
    expect(() => assertQaBuildEnv({ ...safe, VERCEL_PROJECT_ID: "prj_wrong" })).toThrow("Protected QA build failed: vercel-project-id")
    expect(() => assertQaBuildEnv({ ...safe, VERCEL_PROJECT_NAME: "v0-re-new-2-0" })).toThrow("Protected QA build failed: vercel-project-name")
  })

  it("rejects partial Vercel metadata", () => {
    expect(() => assertQaBuildEnv({ VERCEL_PROJECT_NAME: "v0-re-new-2-0" })).toThrow("Protected QA build failed: vercel-project-metadata")
    expect(() => assertQaBuildEnv({ VERCEL_PROJECT_ID: "prj_production" })).toThrow("Protected QA build failed: vercel-project-metadata")
  })

  it("accepts the exact protected validation project contract", () => {
    expect(assertQaBuildEnv(safe)).toEqual({
      projectRef: REF,
      validationProject: "renew-overnight-validation-20260820",
      mailPolicy: "allowlist",
      mailTransport: "simulated",
    })
  })

  it("accepts a normal production Vercel project when protected mode is absent", () => {
    expect(assertQaBuildEnv({
      VERCEL_PROJECT_NAME: "v0-re-new-2-0",
      VERCEL_PROJECT_ID: "prj_production",
    })).toBeNull()
  })

  it("accepts a local build without Vercel metadata or protected mode", () => {
    expect(assertQaBuildEnv({})).toBeNull()
  })

  it("fails closed for production, malformed or mismatched Supabase identity", () => {
    expect(() => assertQaBuildEnv({ ...safe, QA_SUPABASE_PROJECT_REF: "iiuqcdnmxhtyispnykgf" })).toThrow("Protected QA build failed: project-ref")
    expect(() => assertQaBuildEnv({ ...safe, QA_SUPABASE_PROJECT_REF: "short" })).toThrow("Protected QA build failed: project-ref")
    expect(() => assertQaBuildEnv({ ...safe, NEXT_PUBLIC_SUPABASE_URL: "https://iiuqcdnmxhtyispnykgf.supabase.co" })).toThrow("Protected QA build failed: api-ref")
    expect(() => assertQaBuildEnv({ ...safe, DATABASE_URL: "postgresql://postgres.iiuqcdnmxhtyispnykgf:***@aws-0-eu-central-2.pooler.supabase.com:6543/postgres" })).toThrow("Protected QA build failed: database-ref")
  })

  it("fails closed unless mail is allowlisted and simulated without a provider key", () => {
    expect(() => assertQaBuildEnv({ ...safe, QA_MAIL_MODE: "off" })).toThrow("Protected QA build failed: mail-policy")
    expect(() => assertQaBuildEnv({ ...safe, QA_MAIL_TRANSPORT: "provider" })).toThrow("Protected QA build failed: mail-policy")
    expect(() => assertQaBuildEnv({ ...safe, RESEND_API_KEY: "re_real_key" })).toThrow("Protected QA build failed: resend-key")
  })
})
