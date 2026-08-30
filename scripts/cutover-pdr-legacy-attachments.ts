import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const LEGACY_BUCKET = "pdr-attachments"
const PRIVATE_BUCKET = "pdr-intake-attachments"
const LEGACY_PREFIX = `/storage/v1/object/public/${LEGACY_BUCKET}/`
const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "image/jpeg", "image/png",
])

type Candidate = { proposalId: string; sourcePath: string; filename: string; fingerprint: string }
type AttachmentRecord = { storage_path: string; size_bytes: number; content_sha256: string | null }

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const safeFilename = (name: string) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "attachment"

function parseCandidate(proposalId: string, raw: unknown, configuredOrigin: string): Candidate {
  const attachment = raw as { url?: unknown; name?: unknown; filename?: unknown }
  const source = typeof attachment.url === "string" ? attachment.url : null
  const filename = typeof attachment.name === "string" ? attachment.name : typeof attachment.filename === "string" ? attachment.filename : null
  if (!source || !filename) throw new Error("A legacy attachment has no importable source metadata.")

  let parsed: URL
  try { parsed = new URL(source) } catch { throw new Error("A legacy attachment source is invalid.") }
  if (parsed.origin !== configuredOrigin || !parsed.pathname.startsWith(LEGACY_PREFIX) || parsed.search || parsed.hash) {
    throw new Error("A legacy attachment source is outside the configured PDR storage origin.")
  }
  const sourcePath = decodeURIComponent(parsed.pathname.slice(LEGACY_PREFIX.length))
  if (!sourcePath || sourcePath.startsWith("/") || sourcePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("A legacy attachment storage path is unsafe.")
  }
  return { proposalId, sourcePath, filename, fingerprint: sha256(`${proposalId}:${source}`) }
}

function candidateDigest(candidates: Candidate[]) {
  return sha256(candidates.map((item) => item.fingerprint).sort().join("\n"))
}

async function verifyPrivateRecord(db: ReturnType<typeof createClient>, candidate: Candidate, record: AttachmentRecord) {
  const { data, error } = await db.storage.from(PRIVATE_BUCKET).download(record.storage_path)
  if (error || !data) throw new Error("A previously registered private attachment cannot be verified.")
  const bytes = Buffer.from(await data.arrayBuffer())
  if (!bytes.length || bytes.length !== record.size_bytes || (record.content_sha256 && sha256(bytes) !== record.content_sha256)) {
    throw new Error("A previously registered private attachment failed integrity verification.")
  }
}

async function existingRecord(db: ReturnType<typeof createClient>, candidate: Candidate) {
  const { data, error } = await db.from("wave_pdr_request_attachments")
    .select("storage_path,size_bytes,content_sha256")
    .eq("legacy_source_fingerprint", candidate.fingerprint)
    .maybeSingle<AttachmentRecord>()
  if (error) throw new Error("Private attachment metadata cannot be read.")
  return data
}

async function main() {
  const apply = process.argv.includes("--apply")
  const confirmation = process.argv.find((item) => item.startsWith("--confirm="))?.slice(10)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Server-only Supabase environment is required.")
  const configuredOrigin = new URL(url).origin
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: proposals, error } = await db.from("pdr_proposals").select("id,attachments")
  if (error) throw new Error("Legacy PDR attachments cannot be read.")
  const candidates = (proposals ?? []).flatMap((proposal) => Array.isArray(proposal.attachments)
    ? proposal.attachments.map((attachment) => parseCandidate(proposal.id, attachment, configuredOrigin)) : [])
  const digest = candidateDigest(candidates)
  const expectedConfirmation = `${candidates.length}:${digest}`
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", count: candidates.length, digest, confirmation: expectedConfirmation }, null, 2))
  if (!apply) return
  if (confirmation !== expectedConfirmation) throw new Error("Exact count:digest preview confirmation is required.")

  let copied = 0
  for (const candidate of candidates) {
    const existing = await existingRecord(db, candidate)
    if (existing) { await verifyPrivateRecord(db, candidate, existing); continue }

    const { data: source, error: sourceError } = await db.storage.from(LEGACY_BUCKET).download(candidate.sourcePath)
    if (sourceError || !source) throw new Error("A legacy attachment cannot be downloaded through private service access.")
    const bytes = Buffer.from(await source.arrayBuffer())
    const contentType = source.type || "application/octet-stream"
    if (!bytes.length || bytes.length > MAX_BYTES || !ALLOWED_TYPES.has(contentType)) throw new Error("A legacy attachment fails the private intake type or size policy.")
    const contentSha = sha256(bytes)
    const destination = `legacy/${candidate.fingerprint}-${safeFilename(candidate.filename)}`

    // Re-read just before writing to tolerate a concurrent operator without overwriting it.
    const raced = await existingRecord(db, candidate)
    if (raced) { await verifyPrivateRecord(db, candidate, raced); continue }
    const { error: uploadError } = await db.storage.from(PRIVATE_BUCKET).upload(destination, bytes, { contentType, upsert: false })
    if (uploadError && !/already exists/i.test(uploadError.message)) throw new Error("Private attachment upload failed.")
    const { error: insertError } = await db.from("wave_pdr_request_attachments").insert({
      proposal_id: candidate.proposalId, storage_path: destination, original_filename: candidate.filename,
      content_type: contentType, size_bytes: bytes.length, uploaded_by_user_id: "pdr-cutover",
      content_sha256: contentSha, legacy_source_fingerprint: candidate.fingerprint,
    })
    if (insertError) {
      const afterRace = await existingRecord(db, candidate)
      if (!afterRace) throw new Error("Private attachment metadata registration failed.")
      await verifyPrivateRecord(db, candidate, afterRace)
    } else copied += 1
  }

  // Reconcile the exact candidate set without exposing legacy locations.
  const verified = await Promise.all(candidates.map(async (candidate) => {
    const record = await existingRecord(db, candidate)
    if (!record) throw new Error("Private attachment reconciliation failed.")
    await verifyPrivateRecord(db, candidate, record)
    return candidate.fingerprint
  }))
  if (candidateDigest(candidates) !== sha256(verified.sort().join("\n"))) throw new Error("Private attachment reconciliation digest failed.")
  console.log(JSON.stringify({ mode: "applied", count: candidates.length, digest, copied, noOp: copied === 0 }, null, 2))
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Legacy attachment cutover failed."); process.exitCode = 1 })
