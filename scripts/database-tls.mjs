import { X509Certificate } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { checkServerIdentity } from "node:tls"

const poolSource = readFileSync(
  fileURLToPath(new URL("../lib/database/postgres-pool.ts", import.meta.url)),
  "utf8",
)
const caMatch = poolSource.match(/SUPABASE_ROOT_CA_2021 = `([\s\S]*?)`/)
if (!caMatch) throw new Error("Pinned Supabase database CA is unavailable.")
const ca = caMatch[1]
const certificate = new X509Certificate(ca)
if (!certificate.ca) throw new Error("Pinned Supabase database CA is invalid.")

/** Returns discrete pg options so URL ssl parameters cannot weaken TLS. */
export function hardenedDatabaseConfig(connectionString, max = 5) {
  const url = new URL(connectionString)
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("Database URL must be a PostgreSQL URL with a hostname.")
  }
  return {
    host: url.hostname,
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)) || "postgres",
    max,
    ssl: {
      ca,
      rejectUnauthorized: true,
      servername: url.hostname,
      checkServerIdentity,
    },
  }
}
