export type OpportunityStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived"
  | "closed"

export type OpportunityVisibility =
  | "staff_only"
  | "anonymized"
  | "repreneur_visible"

export type MaSourceType = "ma_firm" | "broker" | "direct" | "other"

export type OpportunityDocumentType =
  | "teaser"
  | "deal_book"
  | "nda"
  | "external_analysis"
  | "other"

export type OpportunityDocumentVisibility =
  | "staff_only"
  | "approved_for_repreneur"

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

export type OpportunityPursuitStage =
  | "interest"
  | "info_memo_received"
  | "intermediary_meeting"
  | "seller_meeting"
  | "loi"
  | "closed"
  | "dropped"

export type OpportunityNdaStatus =
  | "not_required"
  | "required"
  | "sent"
  | "signed"
  | "waived"

/** Evidence recorded by staff for the confidentiality gate on one active pursuit. */
export interface OpportunityConfidentialityGate {
  nda_received_at?: string | null
  nda_signed_at?: string | null
  nda_waived_at?: string | null
  nda_waived_by?: string | null
}

export type OpportunityDeclineReasonCategory =
  | "geography"
  | "sector"
  | "size_metrics"
  | "business_model"
  | "other"

export type OpportunityClosureReason =
  | "stale"
  | "sold"
  | "signed_repreneur"
  | "paused_cabinet"
  | "withdrawn_seller"
  | "no_viable_match"
  | "dd_disqualified"
  | "duplicate"

export const OPPORTUNITY_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
  { value: "closed", label: "Closed" },
] as const

export const OPPORTUNITY_CLOSURE_REASON_OPTIONS = [
  { value: "stale", label: "Stale" },
  { value: "sold", label: "Sold" },
  { value: "signed_repreneur", label: "Signed repreneur" },
  { value: "paused_cabinet", label: "Paused by cabinet" },
  { value: "withdrawn_seller", label: "Withdrawn by seller" },
  { value: "no_viable_match", label: "No viable match" },
  { value: "dd_disqualified", label: "Disqualified in due diligence" },
  { value: "duplicate", label: "Duplicate" },
] as const satisfies ReadonlyArray<{
  value: OpportunityClosureReason
  label: string
}>

export const OPPORTUNITY_VISIBILITY_OPTIONS = [
  { value: "staff_only", label: "Staff only" },
  { value: "anonymized", label: "Anonymized" },
  { value: "repreneur_visible", label: "Repreneur visible" },
] as const

export const OPPORTUNITY_INCOMPLETE_DATA_FIELD_OPTIONS = [
  { value: "revenue_meur", label: "CA M€" },
  { value: "ebitda_keur", label: "EBE K€" },
  { value: "headcount_range", label: "Effectif" },
  { value: "source_firm_name", label: "Source" },
  { value: "source_contact", label: "M&A contact" },
] as const

export type OpportunityIncompleteDataField =
  (typeof OPPORTUNITY_INCOMPLETE_DATA_FIELD_OPTIONS)[number]["value"]

export interface OpportunityIncompleteDataWarning {
  missingFields: OpportunityIncompleteDataField[]
}

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

export const OPPORTUNITY_PURSUIT_STAGE_OPTIONS = [
  { value: "interest", label: "Interest" },
  { value: "info_memo_received", label: "Info memo received" },
  { value: "intermediary_meeting", label: "Intermediary meeting" },
  { value: "seller_meeting", label: "Seller meeting" },
  { value: "loi", label: "LOI" },
  { value: "closed", label: "Closed" },
  { value: "dropped", label: "Dropped" },
] as const

export const OPPORTUNITY_NDA_STATUS_OPTIONS = [
  { value: "not_required", label: "Not required" },
  { value: "required", label: "Required" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "waived", label: "Waived" },
] as const

export const OPPORTUNITY_DECLINE_REASON_OPTIONS = [
  { value: "geography", label: "Geography" },
  { value: "sector", label: "Industry / sector" },
  { value: "size_metrics", label: "Size / metrics" },
  { value: "business_model", label: "Business model" },
  { value: "other", label: "Other" },
] as const satisfies ReadonlyArray<{
  value: OpportunityDeclineReasonCategory
  label: string
}>

export function isOpportunityDeclineReasonCategory(
  value: unknown,
): value is OpportunityDeclineReasonCategory {
  return OPPORTUNITY_DECLINE_REASON_OPTIONS.some(
    (option) => option.value === value,
  )
}

export function isOpportunityStatus(
  value: unknown,
): value is OpportunityStatus {
  return OPPORTUNITY_STATUS_OPTIONS.some((option) => option.value === value)
}

export function isOpportunityClosureReason(
  value: unknown,
): value is OpportunityClosureReason {
  return OPPORTUNITY_CLOSURE_REASON_OPTIONS.some(
    (option) => option.value === value,
  )
}

export interface MaSource {
  id: string
  firm_name: string
  source_type: MaSourceType
  network_id?: string | null
  network?: MaSourceNetwork | null
  internal_notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  contacts?: MaSourceContact[]
}

export interface MaSource_Insert {
  firm_name: string
  source_type?: MaSourceType
  network_id?: string | null
  internal_notes?: string | null
  created_by?: string | null
}

export interface MaSource_Update {
  firm_name?: string
  source_type?: MaSourceType
  network_id?: string | null
  internal_notes?: string | null
}

export interface MaSourceContact {
  id: string
  source_id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface MaSourceContact_Insert {
  source_id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  created_by?: string | null
}

export interface MaSourceContact_Update {
  name?: string | null
  email?: string | null
  phone?: string | null
}

export interface MaSourceNetwork {
  id: string
  name: string
  internal_notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface MaSourceContactMove {
  id: string
  contact_id: string
  old_source_id: string
  new_source_id: string
  old_name?: string | null
  new_name?: string | null
  old_email?: string | null
  new_email?: string | null
  old_phone?: string | null
  new_phone?: string | null
  moved_by: string
  moved_at: string
  old_source?: Pick<MaSource, "id" | "firm_name"> | null
  new_source?: Pick<MaSource, "id" | "firm_name"> | null
}

export interface MaSourceContactDirectoryEntry extends MaSourceContact {
  source: MaSource
  move_history: MaSourceContactMove[]
}

export interface MaSourceDirectoryEntry extends MaSource {
  contacts: MaSourceContact[]
  contact_count: number
  opportunity_count: number
  open_opportunity_count: number
  stale_opportunity_count: number
  latest_opportunity_date?: string | null
  latest_opportunity_title?: string | null
}

export interface MaSourceInteraction {
  /**
   * Compatibility projection used by the existing opportunity history panel.
   * New records are stored in ma_interactions; the legacy names keep the
   * reminder and rendering contract stable during the W-062 cutover.
   */
  id: string
  opportunity_id: string
  source_id?: string | null
  contact_id?: string | null
  template_key: string
  channel: "email" | string
  direction: "outbound" | string
  recipient_email: string
  subject: string
  body_markdown?: string | null
  status: "sent" | "failed" | string
  error_message?: string | null
  sent_at?: string | null
  owner_verification_state?: "provisional" | "verified" | string | null
  created_by?: string | null
  created_at: string
}

export interface MaInteraction {
  id: string
  office_id: string
  affiliation_id?: string | null
  opportunity_id?: string | null
  channel: "call" | "email" | "meeting" | "document" | "other" | string
  direction?: "inbound" | "outbound" | null
  occurred_at: string
  owner_staff_user_id: string
  owner_verification_state: "provisional" | "verified" | string
  owner_verified_by?: string | null
  owner_verified_at?: string | null
  title?: string | null
  summary?: string | null
  outcome?: string | null
  next_action?: string | null
  next_action_due_at?: string | null
  template_key?: string | null
  recipient_email_snapshot?: string | null
  body_markdown?: string | null
  delivery_status?: "pending" | "sent" | "failed" | null | string
  delivery_error?: string | null
  sent_at?: string | null
  created_by?: string | null
  created_at: string
  updated_by?: string | null
  updated_at: string
}

export interface Opportunity {
  id: string
  reference: string
  status: OpportunityStatus
  source_id?: string | null
  source_office_id?: string | null
  source_label?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  description?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  headcount_range?: string | null
  date_added?: string | null
  repreneur_exposure: OpportunityVisibility
  public_title?: string | null
  teaser_summary?: string | null
  internal_notes?: string | null
  imported_from?: string | null
  imported_at?: string | null
  archived_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

/** Staff-only canonical operating-office context used by Opportunity Intake. */
export interface MaOfficeIntakeContact {
  affiliation_id: string
  contact_id: string
  contact_name: string | null
  contact_email: string | null
  job_title?: string | null
}

/** Staff-only canonical person available for affiliation to another office. */
export interface MaCanonicalContactOption {
  contact_id: string
  contact_name: string
  contact_email: string | null
}

/** One selectable office and its currently eligible contacts. */
export interface MaOfficeIntakeOffice {
  office_id: string
  firm_id: string
  firm_name: string
  office_name: string
  office_label: string
  contacts: MaOfficeIntakeContact[]
}

/** Canonical staff-only source office resolved through the firm relationship. */
export interface OpportunitySourceOffice {
  id: string
  name: string
  is_default?: boolean
  firm?: {
    id: string
    name: string
  } | null
}

/** Canonical staff-only opportunity contact, anchored to an office affiliation. */
export interface OpportunityMaContact {
  id?: string
  opportunity_id: string
  affiliation_id: string
  is_primary: boolean
  is_active: boolean
  contact_name_snapshot?: string | null
  contact_email_snapshot?: string | null
  contact_phone_snapshot?: string | null
  affiliation?: {
    id: string
    office_id: string
    contact?: {
      id: string
      display_name: string
      email?: string | null
      phone?: string | null
      status?: string | null
    } | null
  } | null
}

export interface OpportunityWithSource extends Opportunity {
  source?: MaSource | null
  source_contacts?: OpportunitySourceContact[]
  source_office?: OpportunitySourceOffice | null
  office_contacts?: OpportunityMaContact[]
  /** Staff-only computed W-064 review state; never project this to repreneurs. */
  source_review_required?: boolean
}

export interface OpportunitySourceContact {
  opportunity_id: string
  source_id: string
  contact_id: string
  is_primary: boolean
  contact_name_snapshot?: string | null
  contact_email_snapshot?: string | null
  contact_phone_snapshot?: string | null
  created_by?: string | null
  created_at: string
  contact?: MaSourceContact | null
}

export interface OpportunityClosureHistoryEntry {
  id: string
  opportunity_id: string
  reason: OpportunityClosureReason
  closed_by: string
  closed_at: string
}

export interface OpportunityActionResult {
  success: boolean
  message: string
  fieldErrors?: Record<string, string>
  incompleteData?: OpportunityIncompleteDataWarning
}

export interface OpportunityWorkSurfaceMatch {
  id: string
  opportunity_id: string
  status: OpportunityMatchStatus
  pursuit_stage?: OpportunityPursuitStage | null
  updated_at: string
  repreneur?: OpportunityMatchRepreneur | null
}

export interface OpportunityWorkSurfaceRecord extends OpportunityWithSource {
  matches: OpportunityWorkSurfaceMatch[]
}

export interface Opportunity_Insert {
  reference: string
  status?: OpportunityStatus
  source_id?: string | null
  source_office_id?: string | null
  source_label?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  description?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  headcount_range?: string | null
  date_added?: string | null
  repreneur_exposure?: OpportunityVisibility
  public_title?: string | null
  teaser_summary?: string | null
  internal_notes?: string | null
  imported_from?: string | null
  imported_at?: string | null
  created_by?: string | null
}

export interface Opportunity_Update {
  reference?: string
  status?: OpportunityStatus
  source_id?: string | null
  source_office_id?: string | null
  source_label?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  description?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  headcount_range?: string | null
  date_added?: string | null
  repreneur_exposure?: OpportunityVisibility
  public_title?: string | null
  teaser_summary?: string | null
  internal_notes?: string | null
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
  repreneur_approved_at?: string | null
  repreneur_approved_by?: string | null
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
  repreneur_approved_at?: string | null
  repreneur_approved_by?: string | null
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
  repreneur_approved_at?: string | null
  repreneur_approved_by?: string | null
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

export interface OpportunityMatch extends OpportunityConfidentialityGate {
  id: string
  opportunity_id: string
  repreneur_id: string
  status: OpportunityMatchStatus
  pursuit_stage?: OpportunityPursuitStage | null
  pursuit_stage_notes?: string | null
  pursuit_stage_updated_by?: string | null
  pursuit_stage_updated_at?: string | null
  nda_status?: OpportunityNdaStatus | null
  nda_document_id?: string | null
  nda_notes?: string | null
  nda_updated_by?: string | null
  nda_updated_at?: string | null
  platform_recommendation: OpportunityMatchRecommendation
  platform_score?: number | null
  platform_reasons: string[]
  human_recommendation: OpportunityMatchRecommendation
  human_notes?: string | null
  decline_reason_categories?: OpportunityDeclineReasonCategory[] | null
  decline_reason_text?: string | null
  created_by?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  interest_expressed_at?: string | null
  interest_notification_sent_at?: string | null
  created_at: string
  updated_at: string
  repreneur?: OpportunityMatchRepreneur | null
}

export interface RepreneurOpportunityMatch extends OpportunityMatch {
  opportunity?: Pick<
    Opportunity,
    | "id"
    | "reference"
    | "public_title"
    | "sector"
    | "activity"
    | "location"
    | "repreneur_exposure"
    | "teaser_summary"
    | "headcount_range"
    | "internal_notes"
  > | null
}

export interface OpportunityMatchCandidate extends OpportunityMatchRepreneur {
  platform_recommendation?: OpportunityMatchRecommendation
  platform_score?: number | null
  platform_reasons?: string[]
}

export interface RepreneurOpportunityCandidate {
  id: string
  reference: string
  public_title?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  platform_recommendation: OpportunityMatchRecommendation
  platform_score: number
  platform_reasons: string[]
}

export interface OpportunityMatchResponse {
  id: string
  opportunity_id: string
  repreneur_id: string
  status: Extract<OpportunityMatchStatus, "interested" | "declined">
  platform_recommendation: OpportunityMatchRecommendation
  platform_score?: number | null
  human_recommendation: OpportunityMatchRecommendation
  human_notes?: string | null
  decline_reason_categories?: OpportunityDeclineReasonCategory[] | null
  decline_reason_text?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  updated_at: string
  opportunity?: Pick<
    Opportunity,
    "id" | "reference" | "public_title" | "sector" | "location"
  > | null
  repreneur?: OpportunityMatchRepreneur | null
  active_pursuit_match_id?: string | null
  active_pursuit_repreneur_id?: string | null
  active_pursuit_repreneur_name?: string | null
  active_pursuit_repreneur_email?: string | null
}

export interface OpportunityPursuitEvent {
  id: string
  match_id: string
  opportunity_id: string
  repreneur_id: string
  stage: OpportunityPursuitStage
  note?: string | null
  created_by?: string | null
  created_at: string
  repreneur?: OpportunityMatchRepreneur | null
}

export interface RepreneurOpportunityProfile {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface RepreneurOpportunityDocument {
  id: string
  title: string
  document_type: OpportunityDocumentType
  file_name?: string | null
  size_bytes?: number | null
  uploaded_at: string
}

export interface RepreneurOpportunityExposure {
  match_id: string
  match_status: OpportunityMatchStatus
  pursuit_stage?: OpportunityPursuitStage | null
  pursuit_stage_updated_at?: string | null
  nda_status?: OpportunityNdaStatus | null
  nda_updated_at?: string | null
  visible_documents: RepreneurOpportunityDocument[]
  opportunity_id: string
  reference: string
  public_title?: string | null
  teaser_summary?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  headcount_range?: string | null
  date_added?: string | null
  decline_reason_categories?: OpportunityDeclineReasonCategory[] | null
  decline_reason_text?: string | null
  interest_expressed_at?: string | null
  interest_notification_sent_at?: string | null
  updated_at: string
  is_locked_for_other_repreneur?: boolean
}

export interface RepreneurDealFlowOpportunity {
  match_id: string | null
  match_status: OpportunityMatchStatus | null
  pursuit_stage?: OpportunityPursuitStage | null
  pursuit_stage_updated_at?: string | null
  nda_status?: OpportunityNdaStatus | null
  nda_updated_at?: string | null
  visible_documents: RepreneurOpportunityDocument[]
  opportunity_id: string
  reference: string
  public_title?: string | null
  teaser_summary?: string | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | null
  ebitda_keur?: number | null
  headcount?: number | null
  headcount_range?: string | null
  date_added?: string | null
  decline_reason_categories?: OpportunityDeclineReasonCategory[] | null
  decline_reason_text?: string | null
  interest_expressed_at?: string | null
  interest_notification_sent_at?: string | null
  updated_at: string
  is_staff_recommended: boolean
  is_outside_current_criteria: boolean
  relevance_grade?: OpportunityMatchRecommendation
  is_locked_for_other_repreneur?: boolean
}

export function getOpportunityStatusLabel(status: OpportunityStatus): string {
  return (
    OPPORTUNITY_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  )
}

export function getOpportunityClosureReasonLabel(
  reason: OpportunityClosureReason,
): string {
  return (
    OPPORTUNITY_CLOSURE_REASON_OPTIONS.find((option) => option.value === reason)
      ?.label ?? reason
  )
}

export function getOpportunityIncompleteDataFieldLabel(
  field: OpportunityIncompleteDataField,
): string {
  return (
    OPPORTUNITY_INCOMPLETE_DATA_FIELD_OPTIONS.find(
      (option) => option.value === field,
    )?.label ?? field
  )
}

export function getOpportunityVisibilityLabel(
  visibility: OpportunityVisibility,
): string {
  return (
    OPPORTUNITY_VISIBILITY_OPTIONS.find((option) => option.value === visibility)
      ?.label ?? visibility
  )
}

export function getOpportunityMatchRecommendationLabel(
  recommendation: OpportunityMatchRecommendation,
): string {
  return (
    OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS.find(
      (option) => option.value === recommendation,
    )?.label ?? recommendation
  )
}

export function getOpportunityMatchStatusLabel(
  status: OpportunityMatchStatus,
): string {
  return (
    OPPORTUNITY_MATCH_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  )
}

export function getOpportunityPursuitStageLabel(
  stage: OpportunityPursuitStage,
): string {
  return (
    OPPORTUNITY_PURSUIT_STAGE_OPTIONS.find((option) => option.value === stage)
      ?.label ?? stage
  )
}

export function getOpportunityNdaStatusLabel(
  status: OpportunityNdaStatus,
): string {
  return (
    OPPORTUNITY_NDA_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  )
}
