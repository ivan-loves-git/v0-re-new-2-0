import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import {
  getRepreneurDocumentDownloadName,
  resolveRepreneurDocumentStoragePath,
} from "@/lib/repreneur-document-storage"
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
  request: NextRequest,
  context: { params: Promise<{ id: string; documentType: string }> },
) {
  const access = await getCurrentUserAccess()
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (access.role !== "staff") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, documentType } = await context.params
  if (!isDocumentType(documentType)) {
    return NextResponse.json({ error: "Unsupported document type" }, { status: 400 })
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

  const shouldDownload = request.nextUrl.searchParams.has("download")
  const downloadName = shouldDownload
    ? getRepreneurDocumentDownloadName(documentType, storagePath)
    : undefined

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("cvs")
    .createSignedUrl(
      storagePath,
      60,
      downloadName ? { download: downloadName } : undefined,
    )

  if (signedUrlError || !signedUrl?.signedUrl) {
    console.error("Repreneur document signing error:", signedUrlError)
    return NextResponse.json(
      { error: "Document file is unavailable" },
      { status: 404 },
    )
  }

  const response = NextResponse.redirect(signedUrl.signedUrl)
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
