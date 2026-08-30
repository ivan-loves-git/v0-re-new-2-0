import { createClient } from "@supabase/supabase-js"

async function main() {
  const apply = process.argv.includes("--apply")
  const confirm = process.argv.find((item) => item.startsWith("--confirm="))?.slice(10)
  const email = process.env.OWNER_STAFF_EMAIL?.trim().toLowerCase()
  if (!email) throw new Error("OWNER_STAFF_EMAIL is required.")
  if (apply && confirm !== "ivan-pdr-disposition") throw new Error("Use --apply --confirm=ivan-pdr-disposition.")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Server-only Supabase environment is required.")
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await db.from("user").select("id,email").eq("email", email).maybeSingle()
  if (error || !data) throw new Error("Owner staff email did not resolve to one Better Auth user.")
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", actorUserId: data.id, email: data.email }, null, 2))
  if (!apply) return
  const { error: upsertError } = await db.from("wave_pdr_governance_capabilities").upsert({ singleton: true, actor_user_id: data.id, can_disposition: true, granted_by: "cutover-operator" }, { onConflict: "singleton" })
  if (upsertError) throw new Error("Capability grant failed.")
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Capability grant failed."); process.exitCode = 1 })
