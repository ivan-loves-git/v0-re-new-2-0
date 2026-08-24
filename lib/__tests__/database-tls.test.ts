import { describe, expect, it } from "vitest"
import { databaseTls } from "@/lib/database-tls"

describe("database TLS", () => {
  it("fails closed without a remote CA and permits only loopback plaintext", () => {
    expect(() => databaseTls("postgres://db.example.test/postgres", {})).toThrow("DATABASE_CA_CERT")
    expect(databaseTls("postgres://localhost/test", {})).toBe(false)
  })
  it("requires certificate verification for remote connections", () => {
    expect(databaseTls("postgres://db.example.test/postgres", { DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nfixture\\n-----END CERTIFICATE-----" })).toMatchObject({ rejectUnauthorized: true })
  })
})
