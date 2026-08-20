import { type NextRequest, NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { createAdminClient } from "@/lib/supabase/admin"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import {
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const trace = startCriticalOperation("portal.memo_download")
  try {
    const { matchId, documentId } = (await context.params) as {
      matchId: string
      documentId: string
    }
    const authorized = await resolvePortalPursuitResource({
      matchId,
      viewer: { kind: "portal" },
      resource: { kind: "information-memorandum", documentId },
    })
    if (
      authorized?.kind !== "information-memorandum" ||
      authorized.documentId !== documentId
    ) {
      trace.failure("authorization_denied")
      return NextResponse.json(
        {
          error:
            "Confidential access has not been granted for this pursuit.",
        },
        { status: 404 },
      )
    }

    const supabase = createAdminClient()
    const { data: match, error: matchError } = await supabase
      .from("opportunity_matches")
      .select("id, opportunity_id")
      .eq("id", matchId)
      .maybeSingle()

    if (matchError) {
      trace.failure("persistence_failed")
      return NextResponse.json({ error: matchError.message }, { status: 500 })
    }
    if (!match) {
      trace.failure("not_found")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { data: document, error: documentError } = await supabase
      .from("opportunity_documents")
      .select("id, document_type, external_url, storage_bucket, storage_path")
      .eq("id", documentId)
      .eq("opportunity_id", match.opportunity_id)
      .maybeSingle()

    if (documentError) {
      trace.failure("persistence_failed")
      return NextResponse.json(
        { error: documentError.message },
        { status: 500 },
      )
    }
    if (!document) {
      trace.failure("not_found")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (document.document_type !== "deal_book") {
      trace.failure("not_found")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (document.external_url) {
      trace.failure("not_found")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!document.storage_path) {
      trace.failure("not_found")
      return NextResponse.json(
        { error: "Document file is unavailable." },
        { status: 404 },
      )
    }

    const bucket = document.storage_bucket || "opportunity-documents"
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(document.storage_path, 60)

    if (signedUrlError || !signedUrl?.signedUrl) {
      trace.failure("storage_failed")
      return privateStorageDownloadError("Document file is unavailable.")
    }
    const response = await proxyPrivateSignedStorageDownload(signedUrl.signedUrl, {
      contentType: "application/pdf",
      filename: "information-memorandum.pdf",
    })
    if (!response) {
      trace.failure("storage_failed")
      return privateStorageDownloadError("Document file is unavailable.")
    }
    trace.success()
    return response
  } catch (error) {
    unstable_rethrow(error)
    trace.failure("internal_error")
    throw error
  }
}
