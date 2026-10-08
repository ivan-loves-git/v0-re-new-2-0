import { createHash } from "node:crypto"
import { getCurrentUserAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { EXTERNAL_LDC_BUCKET } from "@/lib/external-ldc-version"
import { privateStorageDownloadError } from "@/lib/storage/private-signed-download"
import { isUuid } from "@/lib/uuid"

/** Exact retained receipt bytes, never a browser Storage URL or current profile alias. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getCurrentUserAccess()
  if (!access) return privateStorageDownloadError("Unauthorized", 401)
  const { id } = await context.params
  if (!isUuid(id) || !(access.role === "staff" || (access.role === "repreneur" && access.repreneurId))) return privateStorageDownloadError("Not found", 404)
  const db = createAdminClient()
  const { data, error } = await db.rpc("journey_retained_ldc_for_actor", {
    p_receipt_id: id, p_actor_user_id: access.user.id, p_actor_email: access.user.email,
  })
  if (error || !data) return privateStorageDownloadError("Not found", 404)
  const { data: file, error: fileError } = await db.storage.from(EXTERNAL_LDC_BUCKET).download(data.storage_path)
  if (fileError || !file) return privateStorageDownloadError("Document unavailable", 404)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength !== data.size_bytes || createHash("sha256").update(bytes).digest("hex") !== data.content_sha256) return privateStorageDownloadError("Document unavailable", 404)
  return new Response(bytes, { headers: {
    "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength),
    "Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename="Lettre-de-cadrage.pdf"`,
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Referrer-Policy": "no-referrer", "Vary": "Cookie",
  } })
}
