import { requireStaffAccess } from "@/lib/access-control"
import {
  privateSignedDownloadContentType,
  privateSignedDownloadContentTypeFromFilename,
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"
import { createAdminClient } from "@/lib/supabase/admin"
import { isOpportunityInRepreneurNamespace } from "@/lib/repreneur-opportunity-eligibility"
import { isUuid } from "@/lib/uuid"

export async function GET(request: Request, context: { params: Promise<{ id: string; artifactId: string }> }) {
  await requireStaffAccess()
  const { id: opportunityId, artifactId } = await context.params
  if (!isUuid(opportunityId) || !isUuid(artifactId)) {
    return privateStorageDownloadError("Not found", 404)
  }
  const supabase = createAdminClient()

  const { data: artifact, error: artifactError } = await supabase
    .from("opportunity_nda_artifacts")
    .select("document_id, match_id")
    .eq("id", artifactId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (artifactError) {
    return privateStorageDownloadError("Artifact file is unavailable.", 500)
  }
  if (!artifact) {
    return privateStorageDownloadError("Not found", 404)
  }
  if (artifact.match_id) {
    const { data: match, error: matchError } = await supabase
      .from("opportunity_matches")
      .select("opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(is_demo)")
      .eq("id", artifact.match_id)
      .maybeSingle()
    const opportunity = Array.isArray(match?.opportunity) ? match.opportunity[0] : match?.opportunity
    const repreneur = Array.isArray(match?.repreneur) ? match.repreneur[0] : match?.repreneur
    if (matchError || !isOpportunityInRepreneurNamespace(opportunity, repreneur)) {
      return privateStorageDownloadError("Not found", 404)
    }
  }

  const { data: document, error: documentError } = await supabase
    .from("opportunity_documents")
    .select("storage_bucket, storage_path, file_name, mime_type")
    .eq("id", artifact.document_id)
    .eq("opportunity_id", opportunityId)
    .eq("document_type", "nda")
    .eq("visibility", "staff_only")
    .maybeSingle()

  if (documentError) {
    return privateStorageDownloadError("Artifact file is unavailable.", 500)
  }
  if (!document) {
    return privateStorageDownloadError("Not found", 404)
  }

  if (!document.storage_path) {
    return privateStorageDownloadError("Artifact file is unavailable.", 404)
  }

  const storage = supabase.storage.from(document.storage_bucket || "opportunity-documents")
  const { data: signedUrl, error: signedUrlError } = await storage.createSignedUrl(document.storage_path, 60)

  if (signedUrlError) {
    return privateStorageDownloadError("Artifact file is unavailable.", 500)
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
