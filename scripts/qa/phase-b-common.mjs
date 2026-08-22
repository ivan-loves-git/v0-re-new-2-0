import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import pg from "pg"
import { createClient } from "@supabase/supabase-js"
import { assertSafeQaRuntime } from "../../lib/qa/phase-b.mjs"

const { Client } = pg

export const RUN_DIR = resolve(process.env.QA_RUN_DIR || ".qa-run")
export const MANIFEST_FILE = resolve(process.env.QA_FIXTURE_MANIFEST_FILE || `${RUN_DIR}/manifest.json`)
export const EVIDENCE_FILE = resolve(process.env.QA_PREFLIGHT_EVIDENCE_FILE || `${RUN_DIR}/live-preflight.json`)
export const CREDENTIALS_FILE = resolve(process.env.QA_CREDENTIALS_FILE || `${RUN_DIR}/credentials.json`)
export const RESULT_FILE = resolve(process.env.QA_CASE_RESULT_FILE || `${RUN_DIR}/case-result.json`)
export const RUNTIME_FIXTURES_FILE = resolve(process.env.QA_RUNTIME_FIXTURES_FILE || `${RUN_DIR}/runtime-fixtures.json`)
export const SINGLETON_BEFORE_FILE = resolve(process.env.QA_SINGLETON_BEFORE_FILE || `${RUN_DIR}/singleton-before.json`)

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await chmod(path, 0o600)
}

export async function recordRuntimeFixtures(values) {
  let current = {}
  try {
    current = await readJson(RUNTIME_FIXTURES_FILE)
  } catch {}
  const merged = { ...current, ...values }
  await writePrivateJson(RUNTIME_FIXTURES_FILE, merged)
  if (process.env.QA_LEASE_OWNER && process.env.QA_RECOVERY_MODE !== "true") {
    const [fixtureManifest, singletonBefore] = await Promise.all([
      readJson(MANIFEST_FILE),
      readJson(SINGLETON_BEFORE_FILE).catch(() => ({})),
    ])
    const database = await databaseClient()
    try {
      await database.query("SELECT qa_control.persist_manifest($1,$2,$3::jsonb,$4::jsonb)", [
        process.env.QA_RUN_ID,
        process.env.QA_LEASE_OWNER,
        JSON.stringify({ fixtureManifest, runtime: merged }),
        JSON.stringify(singletonBefore),
      ])
    } finally {
      await database.end()
    }
  }
  return merged
}

export async function assertLeaseAuthority(database) {
  if (process.env.QA_RECOVERY_MODE === "true") {
    await database.query("SELECT qa_control.heartbeat_recovery($1,$2)", [process.env.QA_RECOVERY_OWNER, 1800])
    return (await database.query("SELECT manifest, singleton_before FROM qa_control.lease WHERE singleton=true AND status='recovering' AND recovery_owner_hash=qa_control.owner_digest($1)", [process.env.QA_RECOVERY_OWNER])).rows[0]
  }
  await database.query("SELECT qa_control.heartbeat($1,$2,$3)", [process.env.QA_RUN_ID, process.env.QA_LEASE_OWNER, 1800])
  return (await database.query("SELECT manifest, singleton_before FROM qa_control.lease WHERE singleton=true AND status='active' AND run_id=$1 AND owner_hash=qa_control.owner_digest($2)", [process.env.QA_RUN_ID, process.env.QA_LEASE_OWNER])).rows[0]
}

export async function databaseClient() {
  assertSafeQaRuntime(process.env)
  const database = new URL(process.env.DATABASE_URL)
  const ca = await readFile(process.env.QA_DATABASE_CA_CERT_FILE, "utf8")
  const client = new Client({
    host: database.hostname,
    port: Number(database.port || "5432"),
    user: decodeURIComponent(database.username),
    password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || "postgres",
    ssl: { ca, rejectUnauthorized: true },
  })
  await client.connect()
  return client
}

export async function countPublicRows(database) {
  const tables = await database.query(`SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ORDER BY c.relname`)
  let count = 0
  for (const { relname } of tables.rows) {
    const result = await database.query(`SELECT count(*)::int AS count FROM public.${database.escapeIdentifier(relname)}`)
    count += result.rows[0].count
  }
  return count
}

export function storageClient() {
  assertSafeQaRuntime(process.env)
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function refFromSupabaseUrl(value) {
  return new URL(value).hostname.split(".")[0]
}

export function refFromDatabaseUrl(value) {
  const url = new URL(value)
  const direct = url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
  const pooled = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
  return direct || pooled || ""
}

export async function removeRunnerSecrets() {
  await Promise.all([
    rm(CREDENTIALS_FILE, { force: true }),
    rm(resolve(`${RUN_DIR}/auth`), { recursive: true, force: true }),
    rm(resolve(`${RUN_DIR}/pilot.pdf`), { force: true }),
  ])
}

export async function setProvisionalIdentityTriggers(database, enabled) {
  const action = enabled ? "ENABLE" : "DISABLE"
  const triggers = [
    ["ma_firms", "guard_ma_provisional_acme_firm_identity"],
    ["ma_offices", "guard_ma_provisional_acme_office_identity"],
    ["ma_contacts", "guard_ma_provisional_qa_person_contact_identity"],
    ["ma_contact_office_affiliations", "guard_ma_provisional_qa_person_affiliation_identity"],
    ["ma_provisional_source_contexts", "guard_ma_provisional_source_context_identity"],
  ]
  for (const [table, trigger] of triggers) {
    await database.query(`ALTER TABLE public.${table} ${action} TRIGGER ${trigger}`)
  }
}

export async function assertQaMutationTriggersEnabled(database) {
  const triggers = [
    ["ma_firms", "guard_ma_provisional_acme_firm_identity"],
    ["ma_offices", "guard_ma_provisional_acme_office_identity"],
    ["ma_contacts", "guard_ma_provisional_qa_person_contact_identity"],
    ["ma_contact_office_affiliations", "guard_ma_provisional_qa_person_affiliation_identity"],
    ["ma_provisional_source_contexts", "guard_ma_provisional_source_context_identity"],
    ["opportunity_pursuit_evidence", "opportunity_pursuit_evidence_immutable"],
  ]
  for (const [table, trigger] of triggers) {
    const result = await database.query(`SELECT t.tgenabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND t.tgname = $2 AND NOT t.tgisinternal`, [table, trigger])
    if (result.rows.length !== 1 || result.rows[0].tgenabled !== "O") {
      throw new Error("QA mutation preflight failed: trigger-state")
    }
  }
}
