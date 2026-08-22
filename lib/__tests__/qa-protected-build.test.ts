import { describe, expect, it } from "vitest"
import { assertProtectedQaBuildEnv } from "@/lib/qa/protected-build.mjs"

const REF = "pihqnxwougxartvhkelv"
const safe = {
  QA_SUPABASE_PROJECT_REF: REF,
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${REF}:password@aws-0-eu-central-2.pooler.supabase.com:6543/postgres`,
  QA_MAIL_MODE: "allowlist",
  QA_MAIL_TRANSPORT: "simulated",
}

describe("protected QA build contract", () => {
  it("accepts matching non-production API, database, mail and available Vercel identity", () => {
    expect(assertProtectedQaBuildEnv({
      ...safe,
      VERCEL_PROJECT_NAME: "renew-overnight-validation-20260820",
      VERCEL_PROJECT_ID: "prj_validation",
      QA_VALIDATION_PROJECT_ID: "prj_validation",
    })).toEqual({
      projectRef: REF,
      validationProject: "renew-overnight-validation-20260820",
      mailPolicy: "allowlist",
      mailTransport: "simulated",
    })
  })

  it("fails closed for production, malformed or mismatched Supabase identity", () => {
    expect(() => assertProtectedQaBuildEnv({ ...safe, QA_SUPABASE_PROJECT_REF: "iiuqcdnmxhtyispnykgf" })).toThrow("Protected QA build failed: project-ref")
    expect(() => assertProtectedQaBuildEnv({ ...safe, QA_SUPABASE_PROJECT_REF: "short" })).toThrow("Protected QA build failed: project-ref")
    expect(() => assertProtectedQaBuildEnv({ ...safe, NEXT_PUBLIC_SUPABASE_URL: "https://iiuqcdnmxhtyispnykgf.supabase.co" })).toThrow("Protected QA build failed: api-ref")
    expect(() => assertProtectedQaBuildEnv({ ...safe, DATABASE_URL: "postgresql://postgres.iiuqcdnmxhtyispnykgf:password@aws-0-eu-central-2.pooler.supabase.com:6543/postgres" })).toThrow("Protected QA build failed: database-ref")
  })

  it("fails closed unless mail is allowlisted and simulated without a provider key", () => {
    expect(() => assertProtectedQaBuildEnv({ ...safe, QA_MAIL_MODE: "off" })).toThrow("Protected QA build failed: mail-policy")
    expect(() => assertProtectedQaBuildEnv({ ...safe, QA_MAIL_TRANSPORT: "provider" })).toThrow("Protected QA build failed: mail-policy")
    expect(() => assertProtectedQaBuildEnv({ ...safe, RESEND_API_KEY: "re_real_key" })).toThrow("Protected QA build failed: resend-key")
  })

  it("requires exact Vercel name and ID whenever provider metadata is available", () => {
    expect(() => assertProtectedQaBuildEnv({ ...safe, VERCEL_PROJECT_NAME: "v0-re-new-2-0" })).toThrow("Protected QA build failed: vercel-project-name")
    expect(() => assertProtectedQaBuildEnv({ ...safe, VERCEL_PROJECT_ID: "prj_validation" })).toThrow("Protected QA build failed: vercel-project-id")
    expect(() => assertProtectedQaBuildEnv({ ...safe, VERCEL_PROJECT_ID: "prj_wrong", QA_VALIDATION_PROJECT_ID: "prj_validation" })).toThrow("Protected QA build failed: vercel-project-id")
  })
})
