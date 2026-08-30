/** Read-only PDR history reconciliation. It never mutates legacy records. */
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("PDR reconciliation requires the server-only Supabase environment.")

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const tables = ["pdr_proposals", "pdr_requests", "pdr_feedback", "pdr_work_cards"] as const

async function reconcile(table: typeof tables[number]) {
  const { data, error } = await supabase.from(table).select("id").order("id", { ascending: true })
  if (error) throw new Error(`PDR reconciliation could not read ${table}.`)
  const ids = (data ?? []).map((row) => row.id)
  const identifierDigest = createHash("sha256").update(ids.join("\n")).digest("hex")
  return { table, count: ids.length, identifierDigest }
}

async function main() {
  const results = await Promise.all(tables.map(reconcile))
  console.log(JSON.stringify({ schema: 1, readOnly: true, reconciledAt: new Date().toISOString(), tables: results }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "PDR reconciliation failed.")
  process.exitCode = 1
})
