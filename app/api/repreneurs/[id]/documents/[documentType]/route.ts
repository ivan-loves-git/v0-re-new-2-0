import { NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import {
  getRepreneurDocumentDownloadName,
  resolveRepreneurDocumentStoragePath,
} from "@/lib/repreneur-document-storage"
import {
  privateSignedDownloadContentTypeFromFilename,
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"
import { createAdminClient } from "@/lib/supabase/admin"

const DOCUMENT_FIELDS = {
  cv: "cv_url",
  ldc: "ldc_url",
} as const

type DocumentType = keyof typeof DOCUMENT_FIELDS

function isDocumentType(value: string): value is DocumentType {
  return value === "cv" || value === "ldc"
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentType: string }> },
) {
  const access = await getCurrentUserAccess()
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, documentType } = await context.params
  if (!isDocumentType(documentType)) {
    return NextResponse.json({ error: "Unsupported document type" }, { status: 400 })
  }

  const canAccessDocument =
    access.role === "staff" ||
    (access.role === "repreneur" &&
      access.repreneurId === id &&
      documentType === "ldc")
  if (!canAccessDocument) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const field = DOCUMENT_FIELDS[documentType]
  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select("cv_url, ldc_url")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("Repreneur document lookup error:", error)
    return NextResponse.json(
      { error: "Unable to load the document" },
      { status: 500 },
    )
  }

  const storedValue = repreneur?.[field as keyof typeof repreneur]
  if (!storedValue) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const storagePath = resolveRepreneurDocumentStoragePath(storedValue)
  if (!storagePath) {
    return NextResponse.json(
      { error: "Document metadata is unavailable" },
      { status: 404 },
    )
  }

  const downloadName = getRepreneurDocumentDownloadName(documentType, storagePath)
  const shouldDownload = new URL(request.url).searchParams.has("download")

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("cvs")
    .createSignedUrl(storagePath, 60)

  if (signedUrlError || !signedUrl?.signedUrl) {
    console.error("Repreneur document signing error:", signedUrlError)
    return NextResponse.json(
      { error: "Document file is unavailable" },
      { status: 404 },
    )
  }

  const response = await proxyPrivateSignedStorageDownload(signedUrl.signedUrl, {
    filename: downloadName,
    contentType: privateSignedDownloadContentTypeFromFilename(downloadName),
    disposition: shouldDownload ? "attachment" : "inline",
  })
  return response ?? privateStorageDownloadError("Document file is unavailable")
}
