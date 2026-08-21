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
  return merged
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
