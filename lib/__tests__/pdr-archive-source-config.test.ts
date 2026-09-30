import { describe, expect, it } from "vitest"
import { APPROVED_PDR_ARCHIVE_PROJECT_REF, validatePdrArchiveSourceConfig } from "../pdr-archive-source-config"

const project = "iiuqcdnmxhtyispnykgf"
const serviceKey = "sb_secret_synthetic-only"
const trustedCa = "-----BEGIN CERTIFICATE-----\nc3ludGhldGlj\n-----END CERTIFICATE-----"
const storageUrl = `https://${project}.supabase.co`
const directUrl = `postgresql://postgres:synthetic@db.${project}.supabase.co:5432/postgres?sslmode=require`
const poolerUrl = `postgresql://postgres.${project}:synthetic@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`
const source = (overrides: Partial<Parameters<typeof validatePdrArchiveSourceConfig>[0]> = {}) => ({
  expectedProjectRef: project,
  databaseUrl: directUrl,
  supabaseUrl: storageUrl,
  serviceRoleKey: serviceKey,
  trustedPgCaPem: trustedCa,
  ...overrides,
})

describe("PDR live archive source preflight (no network)", () => {
  it("binds direct and pooler PostgreSQL plus Storage to the approved project with repo TLS", () => {
    expect(APPROVED_PDR_ARCHIVE_PROJECT_REF).toBe(project)
    for (const databaseUrl of [directUrl, poolerUrl]) {
      const validated = validatePdrArchiveSourceConfig(source({ databaseUrl }))
      expect(validated.connectionString).not.toContain("sslmode")
      expect(validated.ssl).toEqual({ rejectUnauthorized: true, ca: trustedCa })
      expect(validated.supabaseUrl).toBe(storageUrl)
    }
  })

  it.each([
    { supabaseUrl: `http://${project}.supabase.co` },
    { supabaseUrl: "https://otherproject.supabase.co" },
    { databaseUrl: "postgresql://postgres:synthetic@db.otherproject.supabase.co:5432/postgres" },
    { databaseUrl: `postgresql://postgres.otherproject:synthetic@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` },
    { databaseUrl: `postgresql://postgres:synthetic@db.${project}.supabase.co:5432/postgres?sslmode=disable` },
    { databaseUrl: `postgresql://postgres:synthetic@db.${project}.supabase.co:5432/postgres?sslcert=/tmp/fake` },
    { databaseUrl: "postgresql://postgres:synthetic@127.0.0.1:5432/postgres" },
    { expectedProjectRef: "otherproject" },
    { serviceRoleKey: "sb_publishable_synthetic-only" },
    { trustedPgCaPem: "not-a-certificate" },
  ])("rejects an insecure, mismatched or non-service target %#", (override) => {
    expect(() => validatePdrArchiveSourceConfig(source(override))).toThrow(/PDR archive source/)
  })

  it("accepts a legacy service-role JWT and rejects an anon JWT without trusting either signature", () => {
    const jwt = (role: string, ref = project) => `header.${Buffer.from(JSON.stringify({ role, ref })).toString("base64url")}.signature`
    expect(validatePdrArchiveSourceConfig(source({ serviceRoleKey: jwt("service_role") })).ssl).toEqual({ rejectUnauthorized: true, ca: trustedCa })
    expect(() => validatePdrArchiveSourceConfig(source({ serviceRoleKey: jwt("anon") }))).toThrow(/PDR archive source/)
    expect(() => validatePdrArchiveSourceConfig(source({ serviceRoleKey: jwt("service_role", "otherproject") }))).toThrow(/PDR archive source/)
  })

  it("requires an operator-supplied trusted PostgreSQL CA before connecting", () => {
    expect(() => validatePdrArchiveSourceConfig(source({ trustedPgCaPem: undefined }))).toThrow(/PDR archive source/)
  })
})
