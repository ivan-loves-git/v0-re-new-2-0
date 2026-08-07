"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { triggerOpportunityMemoNotification } from "@/lib/trigger-opportunity-memo-notification"
import type {
  OpportunityDocument,
  OpportunityDocumentType,
  OpportunityDocumentVisibility,
} from "@/lib/types/opportunity"

const OPPORTUNITY_DOCUMENTS_BUCKET = "opportunity-documents"
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
const PDF_ONLY_DOCUMENT_TYPES = new Set<OpportunityDocumentType>([
  "source_teaser",
  "deal_book",
])
const STAFF_ONLY_DOCUMENT_TYPES = new Set<OpportunityDocumentType>([
  "source_teaser",
  "deal_book",
])

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

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

function assertSupportedDocumentType(value: string | null): OpportunityDocumentType {
  const allowed: OpportunityDocumentType[] = ["source_teaser", "teaser", "deal_book", "nda", "external_analysis", "other"]
  if (!value || !allowed.includes(value as OpportunityDocumentType)) {
    throw new Error("Choose a valid document type.")
  }
  return value as OpportunityDocumentType
}

function assertGenericDocumentPolicy(
  documentType: OpportunityDocumentType,
  visibility: OpportunityDocumentVisibility,
  file: FormDataEntryValue | null,
  externalUrl: string | null,
) {
  if (STAFF_ONLY_DOCUMENT_TYPES.has(documentType) && visibility !== "staff_only") {
    throw new Error(`${documentType === "source_teaser" ? "Source teasers" : "Information memoranda"} stay staff-only until the pursuit access workflow grants access.`)
  }
  if (PDF_ONLY_DOCUMENT_TYPES.has(documentType)) {
    if (!(file instanceof File) || file.size === 0 || externalUrl || !isPdf(file)) {
      throw new Error(`${documentType === "source_teaser" ? "Source teasers" : "Information memoranda"} must be uploaded as a PDF.`)
    }
  }
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
  return (data ?? []) as OpportunityDocument[]
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
    assertGenericDocumentPolicy(documentType, visibility, file, externalUrl)

    let storagePath: string | null = null
  let fileName: string | null = null
  let mimeType: string | null = null
  let sizeBytes: number | null = null

    if (file instanceof File && file.size > 0) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error("Document must be smaller than 20MB")
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

    await triggerOpportunityMemoNotification({ opportunityId })

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
    if (STAFF_ONLY_DOCUMENT_TYPES.has(document.document_type as OpportunityDocumentType) && visibility !== "staff_only") {
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
    await triggerOpportunityMemoNotification({ opportunityId })
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
    if (STAFF_ONLY_DOCUMENT_TYPES.has((document as { document_type: OpportunityDocumentType }).document_type)) {
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
