import { createHash, randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

async function main() {
  const apply = process.argv.includes("--apply")
  const confirm = process.argv.find((item) => item.startsWith("--confirm="))?.slice(10)
  if (apply && confirm !== "pdr-legacy-attachments") throw new Error("Use --apply --confirm=pdr-legacy-attachments.")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Server-only Supabase environment is required.")
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: proposals, error } = await db.from("pdr_proposals").select("id,attachments")
  if (error) throw new Error("Legacy PDR attachments cannot be read.")
  const items = (proposals ?? []).flatMap((proposal) => Array.isArray(proposal.attachments) ? proposal.attachments.map((raw) => ({ proposalId: proposal.id, raw })) : [])
  const candidates = items.map(({ proposalId, raw }) => {
    const value = raw as { url?: unknown; name?: unknown; filename?: unknown }
    const source = typeof value.url === "string" ? value.url : null
    const filename = typeof value.name === "string" ? value.name : typeof value.filename === "string" ? value.filename : null
    if (!source || !filename || !source.startsWith("https://")) throw new Error(`Legacy attachment ${proposalId} is not safely importable.`)
    return { proposalId, source, filename }
  })
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", count: candidates.length, identifierDigest: createHash("sha256").update(candidates.map((item) => `${item.proposalId}:${item.source}`).sort().join("\n")).digest("hex") }, null, 2))
  if (!apply) return
  for (const item of candidates) {
    const response = await fetch(item.source, { redirect: "error" })
    if (!response.ok) throw new Error(`Legacy attachment fetch failed for ${item.proposalId}.`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error(`Legacy attachment size rejected for ${item.proposalId}.`)
    const path = `${item.proposalId}/legacy-${randomUUID()}-${item.filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`
    const contentType = response.headers.get("content-type") ?? "application/octet-stream"
    const { error: uploadError } = await db.storage.from("pdr-intake-attachments").upload(path, bytes, { contentType, upsert: false })
    if (uploadError) throw new Error("Private attachment upload failed.")
    const { error: recordError } = await db.from("wave_pdr_request_attachments").insert({ proposal_id: item.proposalId, storage_path: path, original_filename: item.filename, content_type: contentType, size_bytes: bytes.length, uploaded_by_user_id: "pdr-cutover", content_sha256: createHash("sha256").update(bytes).digest("hex"), legacy_source_fingerprint: createHash("sha256").update(item.source).digest("hex") })
    if (recordError) throw new Error("Private attachment record failed.")
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Legacy attachment cutover failed."); process.exitCode = 1 })
