import { NextResponse } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

function privateRedirect(location: string) {
  const response = NextResponse.redirect(location)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

/**
 * Staff-only document delivery. Browser clients never receive storage access;
 * this route authorizes the opportunity/document pair before creating a
 * short-lived URL for the stored object.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  await requireStaffAccess()
  const { id: opportunityId, documentId } = await context.params
  const supabase = createAdminClient()

  const { data: document, error } = await supabase
    .from("opportunity_documents")
    .select("storage_bucket, storage_path, external_url")
    .eq("id", documentId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (document.external_url) return privateRedirect(document.external_url)
  if (!document.storage_path) {
    return NextResponse.json({ error: "Document file is unavailable." }, { status: 404 })
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(document.storage_bucket || "opportunity-documents")
    .createSignedUrl(document.storage_path, 60)
  if (signedUrlError) {
    return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  }

  return privateRedirect(signedUrl.signedUrl)
}
