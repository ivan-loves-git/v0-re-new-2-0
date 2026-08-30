/** Read-only pre-retirement reconciliation against the standalone PDR API. */
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const standaloneOrigin = process.env.PDR_STANDALONE_ORIGIN
const dbOnly = process.argv.includes("--db-only-incomplete")
if (!url || !key) throw new Error("PDR reconciliation requires the server-only Supabase environment.")
if (!dbOnly && !standaloneOrigin) throw new Error("PDR_STANDALONE_ORIGIN is required unless --db-only-incomplete is explicitly used.")

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const tables = ["pdr_proposals", "pdr_requests", "pdr_feedback", "pdr_work_cards"] as const
type Table = typeof tables[number]
type Result = { table: Table; count: number; identifierDigest: string }

const digest = (ids: string[]) => createHash("sha256").update(ids.sort().join("\n")).digest("hex")
async function databaseRows(table: Table): Promise<Result> {
  const { data, error } = await supabase.from(table).select("id")
  if (error) throw new Error("PDR database reconciliation could not read a required table.")
  return { table, count: data?.length ?? 0, identifierDigest: digest((data ?? []).map((row) => row.id)) }
}
function apiRows(payload: Record<string, unknown>, table: Table): { id: string }[] {
  const aliases: Record<Table, string[]> = {
    pdr_proposals: ["pdr_proposals", "proposals"], pdr_requests: ["pdr_requests", "requests"],
    pdr_feedback: ["pdr_feedback", "feedback"], pdr_work_cards: ["pdr_work_cards", "work_cards", "workCards"],
  }
  for (const key of aliases[table]) if (Array.isArray(payload[key]) && payload[key].every((row) => row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string")) return payload[key] as { id: string }[]
  throw new Error("Standalone PDR response is incomplete for reconciliation.")
}
async function standaloneRows(): Promise<Result[]> {
  const origin = new URL(standaloneOrigin!)
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("PDR_STANDALONE_ORIGIN must be a bare HTTPS origin.")
  const response = await fetch(new URL("/api/pdr", origin), { redirect: "error", signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error("Standalone PDR API is unavailable for reconciliation.")
  const payload = await response.json() as Record<string, unknown>
  return tables.map((table) => { const rows = apiRows(payload, table); return { table, count: rows.length, identifierDigest: digest(rows.map((row) => row.id)) } })
}
async function main() {
  const database = await Promise.all(tables.map(databaseRows))
  if (dbOnly) { console.log(JSON.stringify({ schema: 2, readOnly: true, incomplete: true, database }, null, 2)); return }
  const standalone = await standaloneRows()
  if (JSON.stringify(database) !== JSON.stringify(standalone)) throw new Error("Standalone PDR and database reconciliation mismatch.")
  console.log(JSON.stringify({ schema: 2, readOnly: true, matched: true, tables: database }, null, 2))
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "PDR reconciliation failed."); process.exitCode = 1 })
