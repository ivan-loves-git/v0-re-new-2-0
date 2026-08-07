import { NextResponse } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

function privateRedirect(location: string) {
  const response = NextResponse.redirect(location)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function GET(request: Request, context: { params: Promise<{ id: string; artifactId: string }> }) {
  await requireStaffAccess()
  const { id: opportunityId, artifactId } = await context.params
  const supabase = createAdminClient()

  const { data: artifact, error: artifactError } = await supabase
    .from("opportunity_nda_artifacts")
    .select("document_id")
    .eq("id", artifactId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (artifactError) {
    return NextResponse.json({ error: artifactError.message }, { status: 500 })
  }
  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: document, error: documentError } = await supabase
    .from("opportunity_documents")
    .select("storage_bucket, storage_path, file_name")
    .eq("id", artifact.document_id)
    .eq("opportunity_id", opportunityId)
    .eq("document_type", "nda")
    .eq("visibility", "staff_only")
    .maybeSingle()

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 })
  }
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!document.storage_path) {
    return NextResponse.json({ error: "Artifact file is unavailable." }, { status: 404 })
  }

  const storage = supabase.storage.from(document.storage_bucket || "opportunity-documents")
  const shouldDownload = new URL(request.url).searchParams.has("download")
  const { data: signedUrl, error: signedUrlError } = shouldDownload
    ? await storage.createSignedUrl(document.storage_path, 60, {
        download: document.file_name || true,
      })
    : await storage.createSignedUrl(document.storage_path, 60)

  if (signedUrlError) {
    return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  }

  return privateRedirect(signedUrl.signedUrl)
}
