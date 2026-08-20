import { NextResponse } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"
import {
  privateSignedDownloadContentType,
  privateSignedDownloadContentTypeFromFilename,
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"
import { createAdminClient } from "@/lib/supabase/admin"

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
    .select("storage_bucket, storage_path, file_name, mime_type")
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
  const { data: signedUrl, error: signedUrlError } = await storage.createSignedUrl(document.storage_path, 60)

  if (signedUrlError) {
    return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  }

  const shouldDownload = new URL(request.url).searchParams.has("download")
  const response = await proxyPrivateSignedStorageDownload(signedUrl?.signedUrl ?? "", {
    filename: document.file_name,
    contentType: document.mime_type
      ? privateSignedDownloadContentType(document.mime_type)
      : privateSignedDownloadContentTypeFromFilename(
          document.file_name ?? document.storage_path,
        ),
    disposition: shouldDownload ? "attachment" : "inline",
  })
  return response ?? privateStorageDownloadError("Unable to open document.")
}
