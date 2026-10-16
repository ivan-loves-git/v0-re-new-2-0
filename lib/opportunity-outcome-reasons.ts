/** Staff-only business explanations. Category names organize one shared catalogue. */
export const OPPORTUNITY_PURSUIT_DROP_REASON_GROUPS = [
  { label: "Company / market", reasons: [
    { value: "customer_concentration", label: "Customer concentration" },
    { value: "owner_family_dependency", label: "Owner or family dependency" },
    { value: "no_management_team", label: "No management team in place" },
    { value: "lack_recurring_revenue", label: "Lack of recurring revenue" },
    { value: "low_barriers_to_entry", label: "Low barriers to entry" },
    { value: "declining_market", label: "Declining or threatened market" },
    { value: "deteriorating_performance", label: "Deteriorating performance" },
  ] },
  { label: "Economics", reasons: [
    { value: "insufficient_profitability", label: "Insufficient profitability" },
    { value: "unconvincing_ebitda_adjustments", label: "Unconvincing EBITDA adjustments" },
    { value: "below_buyer_size_criteria", label: "Below buyer size criteria" },
    { value: "seller_price_expectations_too_high", label: "Seller price expectations too high" },
    { value: "distressed_financial_position", label: "Distressed financial position" },
    { value: "financing_not_secured", label: "Financing not secured" },
  ] },
  { label: "Thesis", reasons: [
    { value: "outside_investment_thesis", label: "Outside investment thesis" },
    { value: "no_value_creation_angle", label: "No value creation angle" },
    { value: "location_incompatible", label: "Location incompatible" },
  ] },
  { label: "Risks", reasons: [
    { value: "carve_out_risk", label: "Carve-out risk" },
    { value: "assets_premises_not_secured", label: "Assets or premises not secured" },
    { value: "business_plan_not_credible", label: "Business plan not credible" },
    { value: "quality_hr_red_flags", label: "Quality or HR red flags" },
    { value: "issues_in_due_diligence", label: "Issues found in due diligence" },
    { value: "deal_terms_disagreement", label: "Deal terms disagreement" },
  ] },
  { label: "Buyer availability", reasons: [
    { value: "deprioritized_another_deal", label: "Deprioritized for another deal" },
    { value: "buyer_search_paused", label: "Buyer search paused" },
    { value: "no_response_buyer", label: "No response from buyer" },
  ] },
  { label: "External", reasons: [
    { value: "path_stopped_seller_advisor", label: "Path stopped by seller or advisor" },
    { value: "buyer_rejected_seller", label: "Buyer rejected by seller" },
  ] },
  { label: "Unspecified / other", reasons: [
    { value: "reason_not_disclosed", label: "Reason not disclosed" },
    { value: "other", label: "Other" },
  ] },
] as const

export type OpportunityPursuitDropReason = (typeof OPPORTUNITY_PURSUIT_DROP_REASON_GROUPS)[number]["reasons"][number]["value"]
export type HistoricalOpportunityPursuitDropReason = OpportunityPursuitDropReason | "no_viable_match" | "dd_disqualified_repreneur"
export const OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS = OPPORTUNITY_PURSUIT_DROP_REASON_GROUPS.flatMap((group) => [...group.reasons])
export const OPPORTUNITY_PAUSE_REASON_OPTIONS = [
  { value: "paused_cabinet", label: "Paused by cabinet" },
  { value: "seller_paused_sale", label: "Seller paused sale" },
  { value: "exclusivity_another_buyer", label: "Exclusivity granted to another buyer" },
  { value: "waiting_updated_information", label: "Waiting for updated financials/information" },
  { value: "other", label: "Other" },
] as const
export type OpportunityPauseReason = (typeof OPPORTUNITY_PAUSE_REASON_OPTIONS)[number]["value"]

export function isOpportunityPursuitDropReason(value: unknown): value is OpportunityPursuitDropReason {
  return typeof value === "string" && OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS.some((reason) => reason.value === value)
}

export function getOpportunityPursuitDropReasonLabel(value: string): string {
  if (value === "no_viable_match") return "No viable match"
  if (value === "dd_disqualified_repreneur") return "Due diligence — this repreneur only"
  return OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS.find((reason) => reason.value === value)?.label ?? value
}

export interface OpportunityPursuitDropInput {
  primaryReason: OpportunityPursuitDropReason | ""
  secondaryReasons: OpportunityPursuitDropReason[]
  note: string
}

export function validateOpportunityPursuitDropInput(primary: unknown, secondary: unknown = [], note: unknown = null) {
  if (!isOpportunityPursuitDropReason(primary)) return { success: false as const, message: "Choose why this pursuit is ending." }
  if (!Array.isArray(secondary) || secondary.some((reason) => !isOpportunityPursuitDropReason(reason)) || new Set(secondary).size !== secondary.length || secondary.includes(primary)) {
    return { success: false as const, message: "Choose distinct current secondary reasons, different from the main reason." }
  }
  if (note != null && typeof note !== "string") return { success: false as const, message: "Enter a valid context note." }
  const reasonNote = typeof note === "string" ? note.trim() : null
  if (reasonNote && reasonNote.length > 4000) return { success: false as const, message: "Keep the context note within 4,000 characters." }
  if ((primary === "reason_not_disclosed" && secondary.length > 0) || secondary.includes("reason_not_disclosed")) {
    return { success: false as const, message: "Use Reason not disclosed alone, as the main reason." }
  }
  if ((primary === "other" || secondary.includes("other")) && !reasonNote) {
    return { success: false as const, message: "Explain Other, including when it is a secondary reason." }
  }
  return { success: true as const, primaryReason: primary, secondaryReasons: secondary as OpportunityPursuitDropReason[], note: reasonNote || null }
}

export function validateOpportunityPauseInput(reason: unknown, note: unknown = null) {
  if (typeof reason !== "string" || !OPPORTUNITY_PAUSE_REASON_OPTIONS.some((option) => option.value === reason)) {
    return { success: false as const, message: "Choose a valid pause reason.", field: "pause_reason" }
  }
  if (note != null && typeof note !== "string") return { success: false as const, message: "Enter a valid pause explanation.", field: "pause_note" }
  const reasonNote = typeof note === "string" ? note.trim() : ""
  if (reason === "other" && !reasonNote) return { success: false as const, message: "Explain why the whole opportunity is paused.", field: "pause_note" }
  if (reasonNote.length > 4000) return { success: false as const, message: "Keep the explanation within 4,000 characters.", field: "pause_note" }
  return { success: true as const, reason: reason as OpportunityPauseReason, note: reasonNote || null }
}
