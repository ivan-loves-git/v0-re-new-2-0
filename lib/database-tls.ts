import { URL } from "node:url"

export type DatabaseTlsEnvironment = {
  DATABASE_CA_CERT?: string
  NODE_ENV?: string
}

export function databaseTls(connectionString: string, environment: DatabaseTlsEnvironment = process.env) {
  const url = new URL(connectionString)
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  if (local) return false
  const ca = environment.DATABASE_CA_CERT?.replace(/\\n/g, "\n")
  if (!ca || !ca.includes("BEGIN CERTIFICATE")) throw new Error("DATABASE_CA_CERT is required for remote PostgreSQL TLS")
  return { ca, rejectUnauthorized: true }
}
