import type { NextRequest } from "next/server"
import { unstable_rethrow } from "next/navigation"
import { getCurrentUserAccess } from "@/lib/access-control"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"
import { isUuid } from "@/lib/uuid"

function templateDownloadOptions(storagePath: string) {
  if (storagePath.toLowerCase().endsWith(".pdf")) {
    return { contentType: "application/pdf" as const, filename: "nda-template.pdf" }
  }
  if (storagePath.toLowerCase().endsWith(".docx")) {
    return {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
      filename: "nda-template.docx",
    }
  }
  return null
}

/** Staff can download only the selected owner's currently Gate-1-authorized template. */
export async function GET(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  const trace = startCriticalOperation("portal.staff_preview_nda_template_download")
  try {
    const access = await getCurrentUserAccess()
    if (!access) {
      trace.failure("authorization_denied")
      return privateStorageDownloadError("Unauthorized", 401)
    }
    if (access.role !== "staff") {
      trace.failure("authorization_denied")
      return privateStorageDownloadError("Forbidden", 403)
    }

    const repreneurId = request.nextUrl.searchParams.get("repreneurId")
    if (!repreneurId) {
      trace.failure("validation_failed")
      return privateStorageDownloadError("Missing repreneurId", 400)
    }
    const { matchId } = await context.params
    if (!isUuid(repreneurId) || !isUuid(matchId)) {
      trace.failure("validation_failed")
      return privateStorageDownloadError("Not found", 404)
    }
    const template = await resolvePortalPursuitResource({
      matchId,
      viewer: { kind: "staff-preview", repreneurId },
      resource: { kind: "nda-template" },
    })
    if (template?.kind !== "nda-template") {
      trace.failure("authorization_denied")
      return privateStorageDownloadError("Gate 1 is required before the template can be downloaded.", 404)
    }
    const downloadOptions = templateDownloadOptions(template.storagePath)
    if (!downloadOptions) {
      trace.failure("not_found")
      return privateStorageDownloadError("Not found", 404)
    }
    const supabase = createAdminClient()
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(template.storageBucket)
      .createSignedUrl(template.storagePath, 60, { download: true })
    if (signedUrlError || !signedUrl?.signedUrl) {
      trace.failure("storage_failed")
      return privateStorageDownloadError("Template file is unavailable.")
    }
    const response = await proxyPrivateSignedStorageDownload(signedUrl.signedUrl, downloadOptions)
    if (!response) {
      trace.failure("storage_failed")
      return privateStorageDownloadError("Template file is unavailable.")
    }
    trace.success()
    return response
  } catch (error) {
    unstable_rethrow(error)
    trace.failure("internal_error")
    throw error
  }
}
