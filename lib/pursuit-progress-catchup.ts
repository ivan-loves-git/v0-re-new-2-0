import type { OpportunityPursuitStage } from "@/lib/types/opportunity"

/**
 * Operational stages confirmed by staff from the V4 source. This mapping does
 * not stand in for confidentiality evidence or document access.
 */
export const SOURCE_STAGE_TO_CURRENT_STAGE = {
  interest_confirmed: "interest",
  nda_signed: "nda_signed",
  info_memo_received: "info_memo_received",
  qa_with_ma_firm: "qa_with_ma_firm",
  seller_meeting: "seller_meeting",
  loi_issued: "loi",
} as const satisfies Record<string, OpportunityPursuitStage>

export function currentStageForStaffConfirmedHistory(sourceStage: string): OpportunityPursuitStage | null {
  return SOURCE_STAGE_TO_CURRENT_STAGE[sourceStage as keyof typeof SOURCE_STAGE_TO_CURRENT_STAGE] ?? null
}
