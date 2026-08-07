import { type NextRequest, NextResponse } from "next/server"
import { getPortalPursuitProjection } from "@/lib/data/opportunity-pursuit-projection"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { matchId, documentId } = (await context.params) as { matchId: string; documentId: string }
  const projection = await getPortalPursuitProjection(matchId)
  if (!projection?.enabled || projection.revoked || !projection.gate2Passed || !projection.confidentialGrant) {
    return NextResponse.json({ error: "Confidential access has not been granted for this pursuit." }, { status: 404 })
  }
  if (projection.confidentialGrant.informationMemoDocumentId !== documentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const supabase = createAdminClient()

  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity_id")
    .eq("id", matchId)
    .maybeSingle()

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: document, error: documentError } = await supabase
    .from("opportunity_documents")
    .select("id, document_type, external_url, storage_bucket, storage_path")
    .eq("id", documentId)
    .eq("opportunity_id", match.opportunity_id)
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
