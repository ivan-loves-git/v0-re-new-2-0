import { readFileSync } from "node:fs"
import type { ConnectionOptions, PeerCertificate } from "node:tls"
import { describe, expect, it } from "vitest"
import {
  assertCertificateAuthority,
  createHardenedPostgresPoolConfig,
  SUPABASE_ROOT_CA_2021,
} from "@/lib/database/postgres-pool"

function source(path: string) {
  return readFileSync(`${process.cwd()}/${path}`, "utf8")
}

function tlsOptions(connectionString: string) {
  const config = createHardenedPostgresPoolConfig(connectionString)
  expect(config.ssl).not.toBe(false)
  return config.ssl as ConnectionOptions
}

describe("PostgreSQL transport security", () => {
  it("pins the verified Supabase CA and hostname without a connection-string override", () => {
    const connectionString =
      "postgresql://postgres.project:secret@aws-0-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=no-verify&sslrootcert=%2Ftmp%2Fattacker.crt"
    const config = createHardenedPostgresPoolConfig(connectionString)
    const ssl = config.ssl as ConnectionOptions

    expect(config).not.toHaveProperty("connectionString")
    expect(config.host).toBe("aws-0-eu-central-2.pooler.supabase.com")
    expect(config.port).toBe(6543)
    expect(config.user).toBe("postgres.project")
    expect(config.password).toBe("secret")
    expect(config.database).toBe("postgres")
    expect(ssl.ca).toBe(SUPABASE_ROOT_CA_2021)
    expect(ssl.rejectUnauthorized).toBe(true)
    expect(ssl.servername).toBe("aws-0-eu-central-2.pooler.supabase.com")
  })

  it("fails closed for an invalid trust root and a mismatched server certificate", () => {
    expect(() => assertCertificateAuthority("not a certificate")).toThrow(
      "certificate authority is invalid",
    )

    const ssl = tlsOptions(
      "postgresql://postgres:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
    )
    const mismatch = ssl.checkServerIdentity?.(
      "db.abcdefghijklmnopqrst.supabase.co",
      {
        subject: { CN: "attacker.example" },
        subjectaltname: "DNS:attacker.example",
      } as unknown as PeerCertificate,
    )

    expect(mismatch).toBeInstanceOf(Error)
  })

  it("routes every active application database caller through the shared pool", () => {
    for (const path of [
      "lib/auth.ts",
      "lib/security/intake-upload.ts",
      "lib/actions/portal-access.ts",
    ]) {
      const runtimeSource = source(path)
      expect(runtimeSource).toContain("getApplicationPostgresPool")
      expect(runtimeSource).not.toContain("rejectUnauthorized: false")
      expect(runtimeSource).not.toContain("new Pool(")
    }
  })

  it("routes every operational database script through the hardened TLS helper", () => {
    for (const path of [
      "scripts/create-users-direct.ts",
      "scripts/run-w010-cutover.mjs",
      "scripts/verify-w010-live.mjs",
      "scripts/verify-w098-source-workbook.mjs",
      "scripts/prepare-w039-geography-adoption.mjs",
      "scripts/rehearse-w039-geography-adoption.mjs",
    ]) {
      expect(source(path)).toContain("hardenedDatabaseConfig")
      expect(source(path)).not.toContain("rejectUnauthorized: false")
      expect(source(path)).not.toContain("connectionString:")
    }
  })
})
