import { NextResponse } from "next/server"
import { getPortalPursuitProjection } from "@/lib/data/opportunity-pursuit-projection"
import { createAdminClient } from "@/lib/supabase/admin"

function privateRedirect(url: string) {
  const response = NextResponse.redirect(url)
  response.headers.set("cache-control", "private, no-store")
  return response
}

/** The portal may read the exact opportunity template only after canonical Gate 1. */
export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params
  const projection = await getPortalPursuitProjection(matchId)
  if (!projection?.enabled || !projection.gate1Passed || projection.revoked) {
    return NextResponse.json({ error: "Gate 1 is required before the template can be downloaded." }, { status: 404 })
  }

  const supabase = createAdminClient()
  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("opportunity_id")
    .eq("id", matchId)
    .maybeSingle()
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: artifact, error: artifactError } = await supabase
    .from("opportunity_nda_artifacts")
    .select("document_id")
    .eq("opportunity_id", match.opportunity_id)
    .is("match_id", null)
    .eq("artifact_role", "blank_template")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (artifactError) return NextResponse.json({ error: artifactError.message }, { status: 500 })
  if (!artifact) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  const { data: document, error: documentError } = await supabase
    .from("opportunity_documents")
    .select("storage_bucket, storage_path")
    .eq("id", artifact.document_id)
    .maybeSingle()
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
  if (!document?.storage_path) return NextResponse.json({ error: "Template file is unavailable." }, { status: 404 })
  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(document.storage_bucket || "opportunity-documents")
    .createSignedUrl(document.storage_path, 60)
  if (signedUrlError) return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  return privateRedirect(signedUrl.signedUrl)
}
