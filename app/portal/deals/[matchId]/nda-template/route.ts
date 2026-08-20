import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { createAdminClient } from "@/lib/supabase/admin"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import {
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"

function templateDownloadOptions(storagePath: string) {
  if (storagePath.toLowerCase().endsWith(".pdf")) {
    return { contentType: "application/pdf" as const, filename: "nda-template.pdf" }
  }
  if (storagePath.toLowerCase().endsWith(".docx")) {
    return {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
      filename: "nda-template.docx",
    }
  }
  return null
}

/** The portal may read the exact opportunity template only after canonical Gate 1. */
export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const trace = startCriticalOperation("portal.nda_template_download")
  try {
    const { matchId } = await context.params
    const template = await resolvePortalPursuitResource({
      matchId,
      viewer: { kind: "portal" },
      resource: { kind: "nda-template" },
    })
    if (template?.kind !== "nda-template") {
      trace.failure("authorization_denied")
      return NextResponse.json({ error: "Gate 1 is required before the template can be downloaded." }, { status: 404 })
    }

    const downloadOptions = templateDownloadOptions(template.storagePath)
    if (!downloadOptions) {
      trace.failure("not_found")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
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
