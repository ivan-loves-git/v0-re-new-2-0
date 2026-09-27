import { postgresSslForConnection } from "./postgres-ssl"

// The approved WAVE project ref is public project identity, never a credential.
export const APPROVED_PDR_ARCHIVE_PROJECT_REF = "iiuqcdnmxhtyispnykgf"

type SourceConfig = {
  expectedProjectRef: string | null
  databaseUrl: string | undefined
  supabaseUrl: string | undefined
  serviceRoleKey: string | undefined
  trustedPgCaPem: string | undefined
}

function reject(): never {
  throw new Error("PDR archive source requires the approved WAVE project, service role and verified TLS")
}

function serviceRoleKeyShape(key: string, projectRef: string) {
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return
  const parts = key.split(".")
  if (parts.length !== 3 || !parts.every(Boolean)) return reject()
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
    if (payload.role !== "service_role" ||
      (payload.ref != null && payload.ref !== projectRef) ||
      (payload.project_ref != null && payload.project_ref !== projectRef)) return reject()
  } catch {
    return reject()
  }
}

/** Pure preflight; no DNS, database connection or Storage request occurs here. */
export function validatePdrArchiveSourceConfig(config: SourceConfig) {
  const projectRef = config.expectedProjectRef
  if (projectRef !== APPROVED_PDR_ARCHIVE_PROJECT_REF || !config.databaseUrl || !config.supabaseUrl || !config.serviceRoleKey || !config.trustedPgCaPem) return reject()
  const trustedCa = config.trustedPgCaPem.trim()
  if (!trustedCa.startsWith("-----BEGIN CERTIFICATE-----\n") || !trustedCa.endsWith("-----END CERTIFICATE-----")) return reject()

  let database: URL
  let storage: URL
  try {
    database = new URL(config.databaseUrl)
    storage = new URL(config.supabaseUrl)
  } catch {
    return reject()
  }

  const direct = database.hostname === `db.${projectRef}.supabase.co` &&
    database.username === "postgres" && (!database.port || database.port === "5432")
  const pooler = database.hostname.endsWith(".pooler.supabase.com") &&
    database.hostname !== "pooler.supabase.com" &&
    database.username === `postgres.${projectRef}` && ["5432", "6543"].includes(database.port)
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
    (!direct && !pooler) || !database.password || database.pathname !== "/postgres" || database.hash) return reject()

  // node-postgres connection-string SSL parameters can replace the explicit
  // ssl object. Accept only the provider's common `sslmode=require` hint,
  // remove it before construction, and always supply the repository TLS policy.
  const params = [...database.searchParams.entries()]
  if (params.length > 1 || (params.length === 1 && (params[0][0] !== "sslmode" || params[0][1] !== "require"))) return reject()
  database.search = ""

  if (storage.protocol !== "https:" || storage.hostname !== `${projectRef}.supabase.co` ||
    storage.port || storage.username || storage.password || storage.pathname !== "/" || storage.search || storage.hash) return reject()
  serviceRoleKeyShape(config.serviceRoleKey, projectRef)

  const connectionString = database.toString()
  const baselineSsl = postgresSslForConnection(connectionString, {})
  if (!baselineSsl) return reject()
  return {
    connectionString,
    supabaseUrl: storage.origin,
    // Use the repository's remote TLS transport, but require certificate and
    // hostname verification for this high-integrity archive source. A runtime
    // without QA_FIXTURE_MODE prevents the disposable-fixture escape hatch.
    ssl: { ...baselineSsl, rejectUnauthorized: true, ca: trustedCa },
  }
}
