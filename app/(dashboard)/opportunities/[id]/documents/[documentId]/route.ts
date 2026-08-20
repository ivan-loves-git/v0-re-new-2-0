import { requireStaffAccess } from "@/lib/access-control"
import {
  privateSignedDownloadContentType,
  privateSignedDownloadContentTypeFromFilename,
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Staff-only document delivery. Browser clients never receive storage access;
 * this route authorizes the opportunity/document pair before creating a
 * server-side short-lived URL for the stored object.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  await requireStaffAccess()
  const { id: opportunityId, documentId } = await context.params
  const supabase = createAdminClient()

  const { data: document, error } = await supabase
    .from("opportunity_documents")
    .select("storage_bucket, storage_path, file_name, mime_type")
    .eq("id", documentId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (error) return privateStorageDownloadError("Unable to open document.", 500)
  if (!document) return privateStorageDownloadError("Not found", 404)

  const expectedPrefix = `${opportunityId}/`
  if (
    document.storage_bucket !== "opportunity-documents" ||
    !document.storage_path?.startsWith(expectedPrefix)
  ) {
    return privateStorageDownloadError("Not found", 404)
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("opportunity-documents")
    .createSignedUrl(document.storage_path, 60)
  if (signedUrlError) {
    return privateStorageDownloadError("Unable to open document.", 500)
  }

  const shouldDownload = new URL(request.url).searchParams.has("download")
  const response = await proxyPrivateSignedStorageDownload(signedUrl?.signedUrl ?? "", {
    filename: document.file_name,
    contentType: document.mime_type
      ? privateSignedDownloadContentType(document.mime_type)
      : privateSignedDownloadContentTypeFromFilename(
          document.file_name ?? document.storage_path,
        ),
    disposition: shouldDownload ? "attachment" : "inline",
  })
  return response ?? privateStorageDownloadError("Unable to open document.")
}
