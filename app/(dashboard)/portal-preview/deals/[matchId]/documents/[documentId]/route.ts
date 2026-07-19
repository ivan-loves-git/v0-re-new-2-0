import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { canAccessOpportunityMemo, hasCompletedNdaSignature } from "@/lib/opportunity-confidentiality"
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
  const supabase = createAdminClient()

  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity_id, repreneur_id, status, nda_status")
    .eq("id", matchId)
    .eq("repreneur_id", repreneurId)
    .maybeSingle()

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })
  if (!match || match.status !== "active_pursuit") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!hasCompletedNdaSignature(match.nda_status)) {
    return NextResponse.json({ error: "NDA is required before documents can be downloaded." }, { status: 403 })
  }

  const { data: document, error: documentError } = await supabase
    .from("opportunity_documents")
    .select("id, document_type, visibility, external_url, storage_bucket, storage_path")
    .eq("id", documentId)
    .eq("opportunity_id", match.opportunity_id)
    .eq("visibility", "approved_for_repreneur")
    .maybeSingle()

  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canAccessOpportunityMemo(match.nda_status, document)) {
    return NextResponse.json({ error: "Info memo file is unavailable." }, { status: 404 })
  }

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
