"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSafePdfEvidence } from "@/lib/security/pdf-evidence"
import type { OpportunityNdaArtifact, OpportunityNdaArtifactRole } from "@/lib/types/opportunity"

const OPPORTUNITY_DOCUMENTS_BUCKET = "opportunity-documents"
// Keep multipart Server Action requests safely below Vercel's 4.5 MB
// function-payload ceiling.
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
const ARTIFACT_ROLES = new Set<OpportunityNdaArtifactRole>([
  "blank_template",
  "renew_signed_copy",
])
const PDF_MIME_TYPE = "application/pdf"
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return cleaned || "nda.pdf"
}

function isArtifactRole(value: string | null): value is OpportunityNdaArtifactRole {
  return Boolean(value && ARTIFACT_ROLES.has(value as OpportunityNdaArtifactRole))
}

function artifactMimeType(role: OpportunityNdaArtifactRole, file: File) {
  const lowerName = file.name.toLowerCase()
  const expectedMimeType = lowerName.endsWith(".pdf")
    ? PDF_MIME_TYPE
    : lowerName.endsWith(".docx") && role === "blank_template"
      ? DOCX_MIME_TYPE
      : null

  if (!expectedMimeType || file.type !== expectedMimeType) {
    if (role === "blank_template") {
      throw new Error("The blank NDA template must be a PDF or DOCX file")
    }
    throw new Error("Signed NDA copies must be PDF files")
  }

  return expectedMimeType
}

export async function listOpportunityNdaArtifacts(opportunityId: string): Promise<OpportunityNdaArtifact[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_nda_artifacts")
    .select(
      `
      *,
      document:opportunity_documents!opportunity_nda_artifacts_document_id_fkey(*)
    `,
    )
    .eq("opportunity_id", opportunityId)
    .order("recorded_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OpportunityNdaArtifact[]
}

export async function registerOpportunityNdaArtifact(formData: FormData) {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()

  const opportunityId = readString(formData, "opportunity_id")
  const matchId = readString(formData, "match_id")
  const artifactRole = readString(formData, "artifact_role")
  const title = readString(formData, "title")
  const file = formData.get("file")
  const actor = user.email?.trim().toLowerCase()

  if (!opportunityId) throw new Error("Opportunity is required")
  if (!isArtifactRole(artifactRole)) throw new Error("Select a valid NDA artifact role")
  if (!title) throw new Error("Artifact title is required")
  if (!actor) throw new Error("Your staff email is required to record this evidence")
  if (artifactRole === "blank_template" && matchId) {
    throw new Error("The blank NDA template belongs to the opportunity, not a pursuit")
  }
  if (artifactRole !== "blank_template" && !matchId) {
    throw new Error("A signed NDA copy requires an active pursuit")
  }
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error(artifactRole === "blank_template" ? "Upload one PDF or DOCX template" : "Upload one signed PDF file")
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("NDA artifacts must be smaller than 4MB")
  }
  const mimeType = artifactMimeType(artifactRole, file)

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  if (mimeType === PDF_MIME_TYPE) await assertSafePdfEvidence(fileBuffer)
  const contentSha256 = createHash("sha256").update(fileBuffer).digest("hex")
  const storagePath = `${opportunityId}/nda-artifacts/${artifactRole}/${crypto.randomUUID()}-${safeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(OPPORTUNITY_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data, error, status } = await supabase.rpc("register_opportunity_nda_artifact", {
    p_opportunity_id: opportunityId,
    p_match_id: matchId,
    p_artifact_role: artifactRole,
    p_title: title,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_file_size: file.size,
    p_content_sha256: contentSha256,
    p_recorded_by: actor,
  })

  if (error) {
    // A status-0/transport failure can arrive after PostgreSQL committed the
    // RPC or while it was still waiting on the opportunity lock. Poll the
    // unique object path and never delete bytes after an ambiguous response.
    const reconciliationAttempts = status === 0 ? 4 : 1
    let confirmedNoDocument = false

    for (let attempt = 0; attempt < reconciliationAttempts; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250))
      }

      const { data: retainedDocument, error: reconcileError } = await supabase
        .from("opportunity_documents")
        .select("id")
        .eq("opportunity_id", opportunityId)
        .eq("storage_bucket", OPPORTUNITY_DOCUMENTS_BUCKET)
        .eq("storage_path", storagePath)
        .maybeSingle()

      confirmedNoDocument = !reconcileError && !retainedDocument
      if (!reconcileError && retainedDocument) {
        const { data: retainedArtifact, error: artifactReconcileError } = await supabase
          .from("opportunity_nda_artifacts")
          .select("id, version_number")
          .eq("document_id", retainedDocument.id)
          .maybeSingle()

        if (!artifactReconcileError && retainedArtifact) {
          revalidatePath(`/opportunities/${opportunityId}`)
          return {
            success: true,
            artifactId: retainedArtifact.id,
            versionNumber: retainedArtifact.version_number,
          }
        }
      }
    }

    if (status >= 400 && status < 500 && confirmedNoDocument) {
      await supabase.storage.from(OPPORTUNITY_DOCUMENTS_BUCKET).remove([storagePath])
    }
    if (status === 0) {
      throw new Error("Upload outcome is still being confirmed. Refresh before uploading again.")
    }
    throw new Error(error.message)
  }

  revalidatePath(`/opportunities/${opportunityId}`)

  const result = Array.isArray(data) ? data[0] : data
  return {
    success: true,
    artifactId: (result as { artifact_id?: string } | null)?.artifact_id ?? null,
    versionNumber: (result as { version_number?: number } | null)?.version_number ?? null,
  }
}
