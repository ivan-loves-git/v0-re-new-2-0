export type OpportunityStatus = "draft" | "active" | "paused" | "archived" | "closed"

export type OpportunityVisibility = "staff_only" | "anonymized" | "repreneur_visible"

export type MaSourceType = "ma_firm" | "broker" | "direct" | "other"

export type OpportunityDocumentType = "teaser" | "deal_book" | "nda" | "external_analysis" | "other"

export type OpportunityDocumentVisibility = "staff_only" | "approved_for_repreneur"

export type OpportunityMatchRecommendation =
  | "not_evaluated"
  | "strong_fit"
  | "possible_fit"
  | "weak_fit"
  | "not_fit"

export type OpportunityMatchStatus =
  | "draft"
  | "shortlisted"
  | "proposed"
  | "interested"
  | "declined"
  | "active_pursuit"
  | "dropped"

export const OPPORTUNITY_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
  { value: "closed", label: "Closed" },
] as const

export const OPPORTUNITY_VISIBILITY_OPTIONS = [
  { value: "staff_only", label: "Staff only" },
  { value: "anonymized", label: "Anonymized" },
  { value: "repreneur_visible", label: "Repreneur visible" },
] as const

export const MA_SOURCE_TYPE_OPTIONS = [
  { value: "ma_firm", label: "M&A firm" },
  { value: "broker", label: "Broker" },
  { value: "direct", label: "Direct" },
  { value: "other", label: "Other" },
] as const

export const OPPORTUNITY_DOCUMENT_TYPE_OPTIONS = [
  { value: "teaser", label: "Teaser" },
  { value: "deal_book", label: "Deal book" },
  { value: "nda", label: "NDA" },
  { value: "external_analysis", label: "External analysis" },
  { value: "other", label: "Other" },
] as const

export const OPPORTUNITY_DOCUMENT_VISIBILITY_OPTIONS = [
  { value: "staff_only", label: "Staff only" },
  { value: "approved_for_repreneur", label: "Approved for repreneur" },
] as const

export const OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS = [
  { value: "not_evaluated", label: "Not evaluated" },
  { value: "strong_fit", label: "Strong fit" },
  { value: "possible_fit", label: "Possible fit" },
  { value: "weak_fit", label: "Weak fit" },
  { value: "not_fit", label: "Not a fit" },
] as const

export const OPPORTUNITY_MATCH_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "proposed", label: "Proposed" },
  { value: "interested", label: "Interested" },
  { value: "declined", label: "Declined" },
  { value: "active_pursuit", label: "Active pursuit" },
  { value: "dropped", label: "Dropped" },
] as const

export interface MaSource {
  id: string
  firm_name: string
  source_type: MaSourceType
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface MaSource_Insert {
  firm_name: string
  source_type?: MaSourceType
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
  created_by?: string | null
}

export interface MaSource_Update {
  firm_name?: string
  source_type?: MaSourceType
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
}

export interface Opportunity {
  id: string
  reference: string
  status: OpportunityStatus
  source_id?: string | null
  source_label?: string | null
  source_visibility: OpportunityVisibility
  sector?: string | null
  activity?: string | null
  location?: string | null
  description?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  date_added?: string | null
  repreneur_visibility: OpportunityVisibility
  public_title?: string | null
  anonymized_description?: string | null
  staff_notes?: string | null
  imported_from?: string | null
  imported_at?: string | null
  archived_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface OpportunityWithSource extends Opportunity {
  source?: MaSource | null
}

export interface Opportunity_Insert {
  reference: string
  status?: OpportunityStatus
  source_id?: string | null
  source_label?: string | null
  source_visibility?: OpportunityVisibility
  sector?: string | null
  activity?: string | null
  location?: string | null
  description?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  date_added?: string | null
  repreneur_visibility?: OpportunityVisibility
  public_title?: string | null
  anonymized_description?: string | null
  staff_notes?: string | null
  imported_from?: string | null
  imported_at?: string | null
  created_by?: string | null
}

export interface Opportunity_Update {
  reference?: string
  status?: OpportunityStatus
  source_id?: string | null
  source_label?: string | null
  source_visibility?: OpportunityVisibility
  sector?: string | null
  activity?: string | null
  location?: string | null
  description?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  date_added?: string | null
  repreneur_visibility?: OpportunityVisibility
  public_title?: string | null
  anonymized_description?: string | null
  staff_notes?: string | null
  archived_at?: string | null
}

export interface OpportunityDocument {
  id: string
  opportunity_id: string
  title: string
  document_type: OpportunityDocumentType
  visibility: OpportunityDocumentVisibility
  storage_bucket: string
  storage_path?: string | null
  external_url?: string | null
  file_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  uploaded_by?: string | null
  uploaded_at: string
  updated_at: string
}

export interface OpportunityDocument_Insert {
  opportunity_id: string
  title: string
  document_type?: OpportunityDocumentType
  visibility?: OpportunityDocumentVisibility
  storage_bucket?: string
  storage_path?: string | null
  external_url?: string | null
  file_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  uploaded_by?: string | null
}

export interface OpportunityDocument_Update {
  title?: string
  document_type?: OpportunityDocumentType
  visibility?: OpportunityDocumentVisibility
  storage_path?: string | null
  external_url?: string | null
  file_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
}

export interface OpportunityMatchRepreneur {
  id: string
  first_name: string
  last_name: string
  email: string
  lifecycle_status?: string | null
  journey_stage?: string | null
  recommendation?: string | null
  who_score?: number | null
  when_score?: number | null
}

export interface OpportunityMatch {
  id: string
  opportunity_id: string
  repreneur_id: string
  status: OpportunityMatchStatus
  platform_recommendation: OpportunityMatchRecommendation
  platform_score?: number | null
  platform_reasons: string[]
  human_recommendation: OpportunityMatchRecommendation
  human_notes?: string | null
  created_by?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
  repreneur?: OpportunityMatchRepreneur | null
}

export interface OpportunityMatchCandidate extends OpportunityMatchRepreneur {}

export interface OpportunityMatchResponse {
  id: string
  opportunity_id: string
  repreneur_id: string
  status: Extract<OpportunityMatchStatus, "interested" | "declined">
  platform_recommendation: OpportunityMatchRecommendation
  platform_score?: number | null
  human_recommendation: OpportunityMatchRecommendation
  human_notes?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  updated_at: string
  opportunity?: Pick<Opportunity, "id" | "reference" | "public_title" | "sector" | "location"> | null
  repreneur?: OpportunityMatchRepreneur | null
}

export interface RepreneurOpportunityProfile {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface RepreneurOpportunityExposure {
  match_id: string
  match_status: OpportunityMatchStatus
  opportunity_id: string
  public_title?: string | null
  anonymized_description?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  date_added?: string | null
  platform_recommendation: OpportunityMatchRecommendation
  platform_score?: number | null
  platform_reasons: string[]
  human_recommendation: OpportunityMatchRecommendation
  updated_at: string
}

export function getOpportunityStatusLabel(status: OpportunityStatus): string {
  return OPPORTUNITY_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

export function getOpportunityVisibilityLabel(visibility: OpportunityVisibility): string {
  return OPPORTUNITY_VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? visibility
}

export function getOpportunityMatchRecommendationLabel(recommendation: OpportunityMatchRecommendation): string {
  return OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS.find((option) => option.value === recommendation)?.label ?? recommendation
}

export function getOpportunityMatchStatusLabel(status: OpportunityMatchStatus): string {
  return OPPORTUNITY_MATCH_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}
