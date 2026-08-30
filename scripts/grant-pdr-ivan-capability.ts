import { createClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"

async function main() {
  const apply = process.argv.includes("--apply")
  const confirm = process.argv.find((item) => item.startsWith("--confirm="))?.slice(10)
  const email = process.env.OWNER_STAFF_EMAIL?.trim().toLowerCase()
  if (!email) throw new Error("OWNER_STAFF_EMAIL is required.")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Server-only Supabase environment is required.")
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await db.from("user").select("id,email").eq("email", email).maybeSingle()
  if (error || !data) throw new Error("Owner staff email did not resolve to one Better Auth user.")
  const confirmation = createHash("sha256").update(`pdr-ivan:${data.id}`).digest("hex")
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", confirmation }, null, 2))
  if (!apply) return
  if (confirm !== confirmation) throw new Error("Exact preview confirmation is required.")
  const { data: existing, error: existingError } = await db.from("wave_pdr_governance_capabilities").select("actor_user_id").eq("singleton",true).maybeSingle()
  if (existingError) throw new Error("Capability preflight failed.")
  if (existing && existing.actor_user_id !== data.id) throw new Error("Singleton capability already belongs to another actor.")
  if (!existing) { const { error: insertError } = await db.from("wave_pdr_governance_capabilities").insert({ singleton: true, actor_user_id: data.id, can_disposition: true, granted_by: "cutover-operator" }); if (insertError) throw new Error("Capability grant failed.") }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Capability grant failed."); process.exitCode = 1 })
