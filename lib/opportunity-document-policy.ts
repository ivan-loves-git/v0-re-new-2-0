import type {
  OpportunityDocumentType,
  OpportunityDocumentVisibility,
} from "@/lib/types/opportunity"

const PDF_ONLY_DOCUMENT_TYPES = new Set<OpportunityDocumentType>([
  "source_teaser",
  "deal_book",
])
const RETAINED_DOCUMENT_TYPES = new Set<OpportunityDocumentType>([
  "source_teaser",
  "deal_book",
])

export interface OpportunityDocumentPolicy {
  canUpload: boolean
  canView: boolean
  canDownload: boolean
  canReplace: boolean
  canRemove: boolean
  canChangeVisibility: boolean
  requiresPdf: boolean
  retained: boolean
}

export function getOpportunityDocumentPolicy(
  documentType: OpportunityDocumentType,
  isCanonicalNdaArtifact = false,
): OpportunityDocumentPolicy {
  const retained = RETAINED_DOCUMENT_TYPES.has(documentType) || isCanonicalNdaArtifact
  return {
    canUpload: true,
    canView: true,
    canDownload: true,
    canReplace: !retained,
    canRemove: !retained,
    canChangeVisibility: !retained,
    requiresPdf: PDF_ONLY_DOCUMENT_TYPES.has(documentType),
    retained,
  }
}

export function assertGenericOpportunityDocumentPolicy(
  documentType: OpportunityDocumentType,
  visibility: OpportunityDocumentVisibility,
  file: FormDataEntryValue | null,
  externalUrl: string | null,
) {
  const policy = getOpportunityDocumentPolicy(documentType)
  const label = documentType === "source_teaser" ? "Source teasers" : "Information memoranda"
  if (!policy.canChangeVisibility && visibility !== "staff_only") {
    throw new Error(`${label} stay staff-only until the pursuit access workflow grants access.`)
  }
  if (policy.requiresPdf) {
    const isPdf = file instanceof File && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
    if (!isPdf || file.size === 0 || externalUrl) {
      throw new Error(`${label} must be uploaded as a PDF.`)
    }
  }
}
