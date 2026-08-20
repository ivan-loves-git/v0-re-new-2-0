import type {
  OpportunityDocument,
  OpportunityNdaStatus,
  RepreneurMemoAvailability,
} from "@/lib/types/opportunity"

export type OpportunityNdaDisclosureEvidence = Pick<
  {
    nda_status?: OpportunityNdaStatus | null
    nda_signed_at?: string | null
    nda_waived_at?: string | null
    nda_waived_by?: string | null
  },
  "nda_status" | "nda_signed_at" | "nda_waived_at" | "nda_waived_by"
>

type MemoDocument = Pick<
  OpportunityDocument,
  | "document_type"
  | "visibility"
  | "storage_path"
  | "external_url"
  | "repreneur_approved_at"
  | "repreneur_approved_by"
>

/**
 * A status label alone is not disclosure evidence. Signed access requires a
 * recorded signature timestamp; a waiver requires both a timestamp and the
 * staff member who recorded it. Receipt is tracked separately and never
 * grants confidential access.
 */
export function hasCompletedNdaSignature(
  evidence: OpportunityNdaDisclosureEvidence | null | undefined,
) {
  if (evidence?.nda_status === "signed") {
    return Boolean(evidence.nda_signed_at)
  }

  if (evidence?.nda_status === "waived") {
    return Boolean(evidence.nda_waived_at && evidence.nda_waived_by?.trim())
  }

  return false
}

export function hasAvailableOpportunityDocumentAsset(document: MemoDocument | null | undefined) {
  return Boolean(document?.storage_path || document?.external_url)
}

export function hasStaffDocumentDisclosureApproval(document: MemoDocument | null | undefined) {
  return Boolean(
    document?.repreneur_approved_at && document.repreneur_approved_by?.trim(),
  )
}

export function isEligibleOpportunityMemoDocument(document: MemoDocument | null | undefined) {
  return Boolean(
    document?.document_type === "deal_book" &&
      document.visibility === "approved_for_repreneur" &&
      hasStaffDocumentDisclosureApproval(document) &&
      hasAvailableOpportunityDocumentAsset(document),
  )
}

export function canAccessOpportunityMemo(
  evidence: OpportunityNdaDisclosureEvidence | null | undefined,
  document: MemoDocument | null | undefined,
) {
  return hasCompletedNdaSignature(evidence) && isEligibleOpportunityMemoDocument(document)
}

/**
 * Returns only a client-safe explanation of why a memo is not currently
 * exposed. The underlying evidence and document records remain server-only.
 */
export function getRepreneurMemoAvailability(
  evidence: OpportunityNdaDisclosureEvidence | null | undefined,
  documents: Array<MemoDocument | null | undefined>,
): RepreneurMemoAvailability {
  if (documents.some((document) => canAccessOpportunityMemo(evidence, document))) {
    return "available"
  }

  if (evidence?.nda_status === "not_required") {
    return "no_nda_required"
  }

  if (!hasCompletedNdaSignature(evidence)) {
    return "awaiting_confidentiality"
  }

  return "awaiting_document_approval"
}

export function canMarkOpportunityInfoMemoReceived(
  evidence: OpportunityNdaDisclosureEvidence | null | undefined,
  document: MemoDocument | null | undefined,
) {
  return canAccessOpportunityMemo(evidence, document)
}

/**
 * Portal summaries must be independently curated. If a teaser is effectively
 * the same text as the staff-only description, hide it instead of falling back
 * to the internal source text.
 */
export function safeRepreneurTeaserSummary(
  teaserSummary: string | null | undefined,
  internalDescription: string | null | undefined,
) {
  if (!teaserSummary?.trim()) return null
  if (!internalDescription?.trim()) return teaserSummary

  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}_]+/gu, "")

  return normalize(teaserSummary) === normalize(internalDescription)
    ? null
    : teaserSummary
}
