import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

const DOCUMENT_FIELDS = {
  cv: "cv_url",
  ldc: "ldc_url",
} as const

type DocumentType = keyof typeof DOCUMENT_FIELDS

function isDocumentType(value: string): value is DocumentType {
  return value === "cv" || value === "ldc"
}

function extractCvsStoragePath(value: string) {
  if (value.startsWith("cvs/")) return value

  try {
    const url = new URL(value)
    const marker = "/cvs/"
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex >= 0) {
      return `cvs/${decodeURIComponent(url.pathname.slice(markerIndex + marker.length))}`
    }
  } catch {
    // The value is not a legacy public URL.
  }

  return null
}

export async function GET(
  _request: NextRequest,
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const storedValue = repreneur?.[field as keyof typeof repreneur]
  if (!storedValue) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const storagePath = extractCvsStoragePath(storedValue)
  if (!storagePath) {
    return NextResponse.json({ error: "Invalid document path" }, { status: 400 })
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("cvs")
    .createSignedUrl(storagePath, 60)

  if (signedUrlError) {
    return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  }

  return NextResponse.redirect(signedUrl.signedUrl)
}
