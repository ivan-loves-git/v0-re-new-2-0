import { getCurrentUserAccessFromHeaders } from "@/lib/access-control"
import { PDR_ATTACHMENT_BUCKET } from "@/lib/pdr/intake-server"
import { isSafePdrAttachmentPath } from "@/lib/pdr/attachment-path"
import { privateSignedDownloadContentType, privateStorageDownloadError, proxyPrivateSignedStorageDownload } from "@/lib/storage/private-signed-download"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"

/** Staff-only attachment proxy. Storage paths and signed URLs never leave WAVE. */
export async function GET(request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const access = await getCurrentUserAccessFromHeaders(request.headers)
  const { attachmentId } = await context.params
  if (!access || access.role !== "staff" || !isUuid(attachmentId)) return privateStorageDownloadError("Not found", 404)
  const { data, error } = await createAdminClient().from("wave_pdr_history_attachments")
    .select("storage_bucket, storage_path, original_filename, content_type").eq("id", attachmentId).maybeSingle()
  if (error) return privateStorageDownloadError("Unable to open attachment.", 500)
  if (!data || data.storage_bucket !== PDR_ATTACHMENT_BUCKET || !isSafePdrAttachmentPath(data.storage_path)) return privateStorageDownloadError("Not found", 404)
  const { data: signed, error: signedError } = await createAdminClient().storage.from(PDR_ATTACHMENT_BUCKET).createSignedUrl(data.storage_path, 60)
  if (signedError || !signed?.signedUrl) return privateStorageDownloadError("Unable to open attachment.", 500)
  return await proxyPrivateSignedStorageDownload(signed.signedUrl, {
    filename: data.original_filename,
    contentType: privateSignedDownloadContentType(data.content_type),
    disposition: new URL(request.url).searchParams.has("download") ? "attachment" : "inline",
  }) ?? privateStorageDownloadError("Unable to open attachment.")
}
