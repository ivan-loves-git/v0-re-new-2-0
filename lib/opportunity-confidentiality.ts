import type {
  OpportunityDocument,
  OpportunityNdaStatus,
} from "@/lib/types/opportunity"

type MemoDocument = Pick<
  OpportunityDocument,
  "document_type" | "visibility" | "storage_path" | "external_url"
>

/**
 * The existing signed/waived states are the post-NDA authorization boundary.
 * Receipt is tracked separately and never grants confidential access.
 */
export function hasCompletedNdaSignature(
  ndaStatus: OpportunityNdaStatus | null | undefined,
) {
  return ndaStatus === "signed" || ndaStatus === "waived"
}

export function hasAvailableOpportunityDocumentAsset(document: MemoDocument | null | undefined) {
  return Boolean(document?.storage_path || document?.external_url)
}

export function isEligibleOpportunityMemoDocument(document: MemoDocument | null | undefined) {
  return Boolean(
    document?.document_type === "deal_book" &&
      document.visibility === "approved_for_repreneur" &&
      hasAvailableOpportunityDocumentAsset(document),
  )
}

export function canAccessOpportunityMemo(
  ndaStatus: OpportunityNdaStatus | null | undefined,
  document: MemoDocument | null | undefined,
) {
  return hasCompletedNdaSignature(ndaStatus) && isEligibleOpportunityMemoDocument(document)
}

export function canMarkOpportunityInfoMemoReceived(
  ndaStatus: OpportunityNdaStatus | null | undefined,
  document: MemoDocument | null | undefined,
) {
  return canAccessOpportunityMemo(ndaStatus, document)
}
