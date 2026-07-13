"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  OpportunityDocument,
  OpportunityDocumentType,
  OpportunityDocumentVisibility,
} from "@/lib/types/opportunity"

const OPPORTUNITY_DOCUMENTS_BUCKET = "opportunity-documents"
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

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

export async function registerOpportunityDocument(formData: FormData) {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()

  const opportunityId = readString(formData, "opportunity_id")
  const title = readString(formData, "title")
  const file = formData.get("file")
  const externalUrl = readString(formData, "external_url")
  const documentType = (readString(formData, "document_type") as OpportunityDocumentType | null) ?? "other"
  const visibility = (readString(formData, "visibility") as OpportunityDocumentVisibility | null) ?? "staff_only"

  if (!opportunityId) throw new Error("Opportunity is required")
  if (!title) throw new Error("Document title is required")
  if (!(file instanceof File) && !externalUrl) throw new Error("Upload a file or provide an external URL")

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

  const { error } = await supabase.from("opportunity_documents").insert({
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
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/opportunities/${opportunityId}`)
  revalidateOpportunityDashboardTags()
}

export async function updateOpportunityDocumentVisibility(
  documentId: string,
  opportunityId: string,
  visibility: OpportunityDocumentVisibility
) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("opportunity_documents")
    .update({ visibility })
    .eq("id", documentId)

  if (error) throw new Error(error.message)
  revalidatePath(`/opportunities/${opportunityId}`)
  revalidateOpportunityDashboardTags()
}

export async function removeOpportunityDocument(documentId: string, opportunityId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data: document, error: fetchError } = await supabase
    .from("opportunity_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  const storagePath = (document as { storage_path?: string | null } | null)?.storage_path
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(OPPORTUNITY_DOCUMENTS_BUCKET)
      .remove([storagePath])

    if (storageError) throw new Error(storageError.message)
  }

  const { error } = await supabase.from("opportunity_documents").delete().eq("id", documentId)
  if (error) throw new Error(error.message)

  revalidatePath(`/opportunities/${opportunityId}`)
  revalidateOpportunityDashboardTags()
}
