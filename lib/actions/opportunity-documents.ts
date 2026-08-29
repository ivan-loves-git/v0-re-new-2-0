"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  assertGenericOpportunityDocumentPolicy,
  getOpportunityDocumentPolicy,
} from "@/lib/opportunity-document-policy"
import type {
  OpportunityDocument,
  OpportunityDocumentType,
  OpportunityDocumentVisibility,
} from "@/lib/types/opportunity"
import { LEGACY_MULTIPART_MAX_FILE_BYTES } from "@/lib/upload-limits"

const OPPORTUNITY_DOCUMENTS_BUCKET = "opportunity-documents"
const MAX_DOCUMENT_BYTES = LEGACY_MULTIPART_MAX_FILE_BYTES

export type OpportunityDocumentMutationResult =
  | { success: true; message: string; documentId?: string }
  | { success: false; message: string }

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

  return cleaned || "document"
}

function assertSupportedDocumentType(value: string | null): OpportunityDocumentType {
  // NDA evidence has its own immutable, versioned pursuit workflow. New NDA
  // files must never enter the replaceable generic attachment path.
  const allowed: OpportunityDocumentType[] = ["source_teaser", "teaser", "deal_book", "external_analysis", "other"]
  if (!value || !allowed.includes(value as OpportunityDocumentType)) {
    throw new Error("Choose a valid document type.")
  }
  return value as OpportunityDocumentType
}

async function assertDocumentIsNotCanonicalNdaArtifact(
  documentId: string,
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_nda_artifacts")
    .select("id")
    .eq("document_id", documentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data) {
    throw new Error(
      "Canonical NDA artifacts are retained evidence. Register a new version instead.",
    )
  }
}

export async function listOpportunityDocuments(opportunityId: string): Promise<OpportunityDocument[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_documents")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("uploaded_at", { ascending: false })

  if (error) throw new Error(error.message)
  const documents = (data ?? []) as OpportunityDocument[]
  const documentIds = documents.map((document) => document.id)
  if (documentIds.length === 0) return documents

  const [grantsResult, evidenceResult, legacyResult] = await Promise.all([
    supabase.from("opportunity_pursuit_confidential_grants").select("information_memo_document_id").in("information_memo_document_id", documentIds),
    supabase.from("opportunity_pursuit_evidence").select("document_id").in("document_id", documentIds),
    supabase.from("opportunity_matches").select("nda_document_id").in("nda_document_id", documentIds),
  ])
  if (grantsResult.error) throw new Error(grantsResult.error.message)
  if (evidenceResult.error) throw new Error(evidenceResult.error.message)
  if (legacyResult.error) throw new Error(legacyResult.error.message)

  const usedDocumentIds = new Set([
    ...(grantsResult.data ?? []).map((row) => row.information_memo_document_id),
    ...(evidenceResult.data ?? []).map((row) => row.document_id),
    ...(legacyResult.data ?? []).map((row) => row.nda_document_id),
  ].filter((id): id is string => Boolean(id)))
  return documents.map((document) => ({
    ...document,
    can_remove_unused_retained: document.document_type === "deal_book" && !usedDocumentIds.has(document.id),
  }))
}

export async function registerOpportunityDocument(formData: FormData): Promise<OpportunityDocumentMutationResult> {
  try {
    const { user } = await requireStaffAccess()
    const supabase = createAdminClient()

  const opportunityId = readString(formData, "opportunity_id")
  const title = readString(formData, "title")
  const file = formData.get("file")
  const externalUrl = readString(formData, "external_url")
  const documentType = assertSupportedDocumentType(readString(formData, "document_type"))
  const visibility = (readString(formData, "visibility") as OpportunityDocumentVisibility | null) ?? "staff_only"

    if (!opportunityId) throw new Error("Opportunity is required")
    if (!title) throw new Error("Document title is required")
    if (!(file instanceof File) && !externalUrl) throw new Error("Upload a file or provide an external URL")
    assertGenericOpportunityDocumentPolicy(documentType, visibility, file, externalUrl)

    let storagePath: string | null = null
  let fileName: string | null = null
  let mimeType: string | null = null
  let sizeBytes: number | null = null

    if (file instanceof File && file.size > 0) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error("The legacy multipart route is limited to 4 MiB. Use the direct private upload.")
    }

    fileName = file.name
    mimeType = file.type || "application/octet-stream"
    sizeBytes = file.size
    storagePath = `${opportunityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(OPPORTUNITY_DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) throw new Error(uploadError.message)
    }

    const disclosureApproval = visibility === "approved_for_repreneur"
    ? {
        repreneur_approved_at: new Date().toISOString(),
        repreneur_approved_by: user.id,
      }
    : {}

    const { data: inserted, error } = await supabase.from("opportunity_documents").insert({
    opportunity_id: opportunityId,
    title,
    document_type: documentType,
    visibility,
    storage_bucket: OPPORTUNITY_DOCUMENTS_BUCKET,
    storage_path: storagePath,
    external_url: externalUrl,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    uploaded_by: user.id,
    ...disclosureApproval,
    }).select("id").single()

    if (error) throw new Error(error.message)

    // Upload is never a disclosure decision and has no notification side
    // effect. Only the canonical pursuit grant may notify a repreneur.

    revalidatePath(`/opportunities/${opportunityId}`)
    revalidateOpportunityDashboardTags()
    return { success: true, message: "Document added.", documentId: inserted.id }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Document could not be added." }
  }
}

export async function updateOpportunityDocumentVisibility(
  documentId: string,
  opportunityId: string,
  visibility: OpportunityDocumentVisibility
) : Promise<OpportunityDocumentMutationResult> {
  try {
    const { user } = await requireStaffAccess()
    await assertDocumentIsNotCanonicalNdaArtifact(documentId)
    const supabase = createAdminClient()

    const { data: document, error: fetchError } = await supabase
      .from("opportunity_documents")
      .select("document_type")
      .eq("id", documentId)
      .eq("opportunity_id", opportunityId)
      .maybeSingle()
    if (fetchError) throw new Error(fetchError.message)
    if (!document) throw new Error("Document not found.")
    const policy = getOpportunityDocumentPolicy(document.document_type as OpportunityDocumentType)
    if (!policy.canChangeVisibility && visibility !== "staff_only") {
      throw new Error("Source teasers and Information Memoranda are granted through the pursuit access workflow, not this control.")
    }

  // Existing records are never silently blessed: moving a document into the
  // repreneur-visible state records the staff actor and time for this specific
  // approval. Returning to staff-only preserves that audit evidence while the
  // visibility flag closes access immediately.
  const disclosureApproval = visibility === "approved_for_repreneur"
    ? {
        repreneur_approved_at: new Date().toISOString(),
        repreneur_approved_by: user.id,
      }
    : {}

    const { error } = await supabase
    .from("opportunity_documents")
    .update({ visibility, ...disclosureApproval })
    .eq("id", documentId)
    .eq("opportunity_id", opportunityId)

    if (error) throw new Error(error.message)
    revalidatePath(`/opportunities/${opportunityId}`)
    revalidateOpportunityDashboardTags()
    return { success: true, message: visibility === "staff_only" ? "Document is now staff-only." : "Document approval recorded." }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Document visibility could not be updated." }
  }
}

export async function removeOpportunityDocument(documentId: string, opportunityId: string): Promise<OpportunityDocumentMutationResult> {
  try {
    await requireStaffAccess()
    await assertDocumentIsNotCanonicalNdaArtifact(documentId)
    const supabase = createAdminClient()

  const { data: document, error: fetchError } = await supabase
    .from("opportunity_documents")
    .select("storage_path, document_type")
    .eq("id", documentId)
    .eq("opportunity_id", opportunityId)
    .single()

    if (fetchError) throw new Error(fetchError.message)
    const policy = getOpportunityDocumentPolicy((document as { document_type: OpportunityDocumentType }).document_type)
    if (!policy.canRemove) {
      throw new Error("Retained source teasers and Information Memoranda cannot be removed. Upload a corrected PDF as a new document.")
    }

    const storagePath = (document as { storage_path?: string | null } | null)?.storage_path
    if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(OPPORTUNITY_DOCUMENTS_BUCKET)
      .remove([storagePath])

    if (storageError) throw new Error(storageError.message)
    }

    const { error } = await supabase
    .from("opportunity_documents")
    .delete()
    .eq("id", documentId)
    .eq("opportunity_id", opportunityId)
    if (error) throw new Error(error.message)

    revalidatePath(`/opportunities/${opportunityId}`)
    revalidateOpportunityDashboardTags()
    return { success: true, message: "Document removed." }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Document could not be removed." }
  }
}

/**
 * W-170's only retained-document correction path. The database removes the
 * live metadata before this action touches Storage, so a Storage outage leaves
 * a harmless private orphan plus a retryable server-only receipt, never a
 * document row that points to missing bytes.
 */
export async function removeUnusedRetainedOpportunityDocument({
  opportunityId,
  documentId,
}: {
  opportunityId: string
  documentId: string
}): Promise<OpportunityDocumentMutationResult> {
  try {
    await requireStaffAccess()
    if (!opportunityId || !documentId) throw new Error("Opportunity and document are required.")

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("remove_unused_retained_opportunity_document", {
      p_opportunity_id: opportunityId,
      p_document_id: documentId,
    })
    if (error) throw new Error(error.message)

    const cleanup = (Array.isArray(data) ? data[0] : data) as {
      cleanup_id?: string
      storage_bucket?: string
      storage_path?: string
    } | null
    if (!cleanup?.cleanup_id || !cleanup.storage_bucket || !cleanup.storage_path) {
      throw new Error("The retained-document correction did not return private cleanup details.")
    }

    const { error: storageError } = await supabase.storage
      .from(cleanup.storage_bucket).remove([cleanup.storage_path])
    if (storageError) {
      return {
        success: false,
        message: "Document metadata was removed, but private Storage cleanup is still pending. Retry Remove to finish cleanup.",
      }
    }

    const { error: completionError } = await supabase.rpc(
      "complete_unused_retained_opportunity_document_cleanup",
      { p_cleanup_id: cleanup.cleanup_id, p_opportunity_id: opportunityId },
    )
    if (completionError) {
      return {
        success: false,
        message: "Document metadata and private bytes were removed, but cleanup confirmation is still pending. Retry Remove safely.",
      }
    }

    revalidatePath(`/opportunities/${opportunityId}`)
    revalidateOpportunityDashboardTags()
    return { success: true, message: "Unused retained document removed." }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unused retained document could not be removed.",
    }
  }
}
