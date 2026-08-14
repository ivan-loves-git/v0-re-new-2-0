import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const access = await getCurrentUserAccess()
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (access.role !== "staff") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const repreneurId = request.nextUrl.searchParams.get("repreneurId")
  if (!repreneurId) return NextResponse.json({ error: "Missing repreneurId" }, { status: 400 })

  const { matchId, documentId } = (await context.params) as { matchId: string; documentId: string }
  const authorized = await resolvePortalPursuitResource({
    matchId,
    viewer: { kind: "staff-preview", repreneurId },
    resource: { kind: "information-memorandum", documentId },
  })
  if (
    authorized?.kind !== "information-memorandum"
    || authorized.documentId !== documentId
  ) {
    return NextResponse.json({ error: "Confidential access has not been granted for this pursuit." }, { status: 404 })
  }
  const supabase = createAdminClient()

  const { data: document, error: documentError } = await supabase
    .from("opportunity_documents")
    .select("id, document_type, external_url, storage_bucket, storage_path")
    .eq("id", documentId)
    .maybeSingle()

  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (document.document_type !== "deal_book") return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (document.external_url) {
    return NextResponse.redirect(document.external_url)
  }

  if (!document.storage_path) {
    return NextResponse.json({ error: "Document file is unavailable." }, { status: 404 })
  }

  const bucket = document.storage_bucket || "opportunity-documents"
  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(document.storage_path, 60)

  if (signedUrlError) return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  return NextResponse.redirect(signedUrl.signedUrl)
}
