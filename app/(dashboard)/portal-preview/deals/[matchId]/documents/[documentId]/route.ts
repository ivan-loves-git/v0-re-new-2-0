import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { createAdminClient } from "@/lib/supabase/admin"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export async function GET(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const trace = startCriticalOperation("portal.staff_preview_memo_download")
  try {
    const access = await getCurrentUserAccess()
    if (!access) {
      trace.failure("authorization_denied")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (access.role !== "staff") {
      trace.failure("authorization_denied")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const repreneurId = request.nextUrl.searchParams.get("repreneurId")
    if (!repreneurId) {
      trace.failure("validation_failed")
      return NextResponse.json({ error: "Missing repreneurId" }, { status: 400 })
    }

    const { matchId, documentId } = (await context.params) as {
      matchId: string
      documentId: string
    }
    const authorized = await resolvePortalPursuitResource({
      matchId,
      viewer: { kind: "staff-preview", repreneurId },
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

    const { data: document, error: documentError } = await supabase
      .from("opportunity_documents")
      .select("id, document_type, external_url, storage_bucket, storage_path")
      .eq("id", documentId)
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
      trace.success()
      return NextResponse.redirect(document.external_url)
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

    if (signedUrlError) {
      trace.failure("storage_failed")
      return NextResponse.json(
        { error: signedUrlError.message },
        { status: 500 },
      )
    }
    trace.success()
    return NextResponse.redirect(signedUrl.signedUrl)
  } catch (error) {
    trace.failure("internal_error")
    throw error
  }
}
