import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUserAccess } from "@/lib/access-control"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { recalculateRepreneurScoresAndMatches } from "@/lib/repreneur-profile-refresh"
import { resolveRepreneurDocumentStoragePath } from "@/lib/repreneur-document-storage"
import {
  IntakeUploadSecurityError,
  verifyAndConsumeIntakeUploadToken,
} from "@/lib/security/intake-upload"
import {
  LEGACY_MULTIPART_MAX_FILE_BYTES,
  LEGACY_MULTIPART_MAX_FILE_LABEL,
  VERCEL_FUNCTION_MAX_REQUEST_BYTES,
} from "@/lib/upload-limits"

const DOCUMENT_FIELDS = {
  cv: "cv_url",
  ldc: "ldc_url",
} as const

type DocumentType = keyof typeof DOCUMENT_FIELDS

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

const MAGIC_BYTES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  doc: [0xd0, 0xcf, 0x11, 0xe0],
  docx: [0x50, 0x4b, 0x03, 0x04],
}

function normalizeDocumentType(value: FormDataEntryValue | null): DocumentType {
  return value === "ldc" ? "ldc" : "cv"
}

function safeStorageOwnerId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96)
}

function verifyFileContent(bytes: Uint8Array, extension: string) {
  const expected = MAGIC_BYTES[extension]
  return Boolean(
    expected && expected.every((byte, index) => bytes[index] === byte),
  )
}

function documentDownloadUrl(repreneurId: string, documentType: DocumentType) {
  return `/api/repreneurs/${encodeURIComponent(repreneurId)}/documents/${documentType}`
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > VERCEL_FUNCTION_MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Upload is too large" },
        { status: 413 },
      )
    }

    const access = await getCurrentUserAccess()
    // Anonymous intake uploads consume their one-time capability before body
    // parsing. Vercel enforces the outer 4.5 MB request boundary, while the
    // deprecated compatibility endpoint enforces its 4 MiB file ceiling after multipart parse.
    const anonymousIntakeGrant = !access
      ? await verifyAndConsumeIntakeUploadToken(
          request,
          request.headers.get("x-intake-upload-token"),
        )
      : null

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const repreneurId = formData.get("repreneurId") as string | null
    const documentType = normalizeDocumentType(formData.get("documentType"))
    const isOwnedPortalUpload =
      access?.role === "repreneur" && access.repreneurId === repreneurId
    const intakeGrant = !repreneurId && access?.role !== "staff"
      ? anonymousIntakeGrant ?? await verifyAndConsumeIntakeUploadToken(
          request,
          request.headers.get("x-intake-upload-token"),
        )
      : null

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    if (repreneurId) {
      if (!access)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      if (access.role !== "staff" && !isOwnedPortalUpload)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase()
    if (!fileExt || !(fileExt in MIME_BY_EXTENSION)) {
      return NextResponse.json(
        { error: "File must be a PDF or Word document" },
        { status: 400 },
      )
    }

    if (file.size > LEGACY_MULTIPART_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File size must not exceed ${LEGACY_MULTIPART_MAX_FILE_LABEL}` },
        { status: 400 },
      )
    }

    const headerBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (!verifyFileContent(headerBytes, fileExt)) {
      return NextResponse.json(
        { error: "File content does not match the file extension" },
        { status: 400 },
      )
    }

    const ownerId = safeStorageOwnerId(
      repreneurId || `intake-${intakeGrant?.id}`,
    )
    const filePath = `cvs/${ownerId}-${documentType}-${Date.now()}.${fileExt}`

    const adminClient = createAdminClient()

    if (isOwnedPortalUpload && documentType === "ldc") {
      const { data: repreneur, error: validationError } = await adminClient
        .from("repreneurs")
        .select("ms_ldc_validated")
        .eq("id", repreneurId)
        .maybeSingle()

      if (validationError) {
        console.error("LDC validation lookup error:", validationError)
        return NextResponse.json(
          { error: "Failed to validate the current document" },
          { status: 500 },
        )
      }
      if (repreneur?.ms_ldc_validated) {
        return NextResponse.json(
          { error: "This Lettre de cadrage is already validated by Re-New and cannot be replaced here." },
          { status: 409 },
        )
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminClient.storage
      .from("cvs")
      .upload(filePath, buffer, {
        contentType: MIME_BY_EXTENSION[fileExt],
        upsert: true,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 },
      )
    }

    if (repreneurId) {
      const field = DOCUMENT_FIELDS[documentType]
      const { error: updateError } = await adminClient
        .from("repreneurs")
        .update({
          [field]: filePath,
          ...(isOwnedPortalUpload && documentType === "ldc"
            ? { ldc_self_certified_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", repreneurId)

      if (updateError) {
        console.error("Document profile update error:", updateError)
        return NextResponse.json(
          { error: "Failed to attach document" },
          { status: 500 },
        )
      }

      revalidatePath("/repreneurs")
      revalidatePath(`/repreneurs/${repreneurId}`)
      revalidateRepreneurDashboardTags()
      if (documentType === "ldc") {
        await recalculateRepreneurScoresAndMatches(repreneurId)
      } else if (isOwnedPortalUpload) {
        revalidatePath("/portal/profile")
      }

      return NextResponse.json({
        path: filePath,
        url: documentDownloadUrl(repreneurId, documentType),
      })
    }

    return NextResponse.json({ path: filePath, url: filePath })
  } catch (error) {
    if (error instanceof IntakeUploadSecurityError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : undefined,
        },
      )
    }
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getCurrentUserAccess()
    if (!access)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (access.role !== "staff")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const {
      repreneurId,
      cvUrl,
      documentType: requestedType,
    } = await request.json()
    const documentType: DocumentType = requestedType === "ldc" ? "ldc" : "cv"
    const field = DOCUMENT_FIELDS[documentType]

    if (!repreneurId || !cvUrl) {
      return NextResponse.json(
        { error: "Missing repreneurId or document URL" },
        { status: 400 },
      )
    }

    const adminClient = createAdminClient()
    const { data: repreneur, error: fetchError } = await adminClient
      .from("repreneurs")
      .select("cv_url, ldc_url")
      .eq("id", repreneurId)
      .maybeSingle()

    if (fetchError) {
      console.error("Document owner fetch error:", fetchError)
      return NextResponse.json(
        { error: "Failed to load document owner" },
        { status: 500 },
      )
    }

    const storedValue = repreneur?.[field as keyof typeof repreneur]
    if (!storedValue || storedValue !== cvUrl) {
      return NextResponse.json(
        { error: "Document does not belong to this repreneur" },
        { status: 403 },
      )
    }

    const filePath = resolveRepreneurDocumentStoragePath(storedValue)
    if (!filePath) {
      return NextResponse.json(
        { error: "Invalid document path" },
        { status: 400 },
      )
    }

    const { error: deleteError } = await adminClient.storage
      .from("cvs")
      .remove([filePath])

    if (deleteError) {
      console.error("Storage delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 },
      )
    }

    const { error: updateError } = await adminClient
      .from("repreneurs")
      .update({ [field]: null })
      .eq("id", repreneurId)

    if (updateError) {
      console.error("Document profile clear error:", updateError)
      return NextResponse.json(
        { error: "Failed to clear document" },
        { status: 500 },
      )
    }

    revalidatePath("/repreneurs")
    revalidatePath(`/repreneurs/${repreneurId}`)
    revalidateRepreneurDashboardTags()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
