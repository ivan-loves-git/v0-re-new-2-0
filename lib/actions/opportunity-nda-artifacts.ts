"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isOpportunityInRepreneurNamespace } from "@/lib/repreneur-opportunity-eligibility"
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
  const artifacts = (data ?? []) as unknown as OpportunityNdaArtifact[]
  if (artifacts.length === 0) return artifacts
  const matchIds = artifacts
    .map((artifact) => artifact.match_id)
    .filter((matchId): matchId is string => Boolean(matchId))
  const artifactIds = artifacts.map((artifact) => artifact.id)
  const documentIds = artifacts.map((artifact) => artifact.document_id)
  const [evidenceResult, legacyResult] = await Promise.all([
    supabase.from("opportunity_pursuit_evidence").select("nda_artifact_id, document_id").or(`nda_artifact_id.in.(${artifactIds.join(",")}),document_id.in.(${documentIds.join(",")})`),
    supabase.from("opportunity_matches").select("nda_document_id").in("nda_document_id", documentIds),
  ])
  if (evidenceResult.error) throw new Error(evidenceResult.error.message)
  if (legacyResult.error) throw new Error(legacyResult.error.message)
  const usedArtifactIds = new Set((evidenceResult.data ?? []).map((row) => row.nda_artifact_id).filter((id): id is string => Boolean(id)))
  const usedDocumentIds = new Set([
    ...(evidenceResult.data ?? []).map((row) => row.document_id),
    ...(legacyResult.data ?? []).map((row) => row.nda_document_id),
  ].filter((id): id is string => Boolean(id)))
  const projected = artifacts.map((artifact) => ({
    ...artifact,
    can_remove_unused_retained: !usedArtifactIds.has(artifact.id)
      && !usedDocumentIds.has(artifact.document_id)
      && !artifacts.some((other) => other.supersedes_artifact_id === artifact.id
        || (other.opportunity_id === artifact.opportunity_id
          && other.match_id === artifact.match_id
          && other.artifact_role === artifact.artifact_role
          && other.version_number > artifact.version_number)),
  }))
  if (matchIds.length === 0) return projected

  const { data: matches, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(is_demo)")
    .in("id", matchIds)
  if (matchError) throw new Error(matchError.message)
  const sameNamespaceMatchIds = new Set(
    (matches ?? [])
      .filter((match) => isOpportunityInRepreneurNamespace(
        Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity,
        Array.isArray(match.repreneur) ? match.repreneur[0] : match.repreneur,
      ))
      .map((match) => match.id),
  )
  return projected.filter((artifact) => (
    !artifact.match_id || sameNamespaceMatchIds.has(artifact.match_id)
  ))
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
    throw new Error("The legacy multipart route is limited to 4 MiB. Use the direct private upload.")
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
