export type LifecycleStatus = "lead" | "qualified" | "client" | "rejected" | "declined" | "to_reactivate"

// Decline reason categories (when repreneur declines Re-New's offer)
export type DeclineReasonCategory =
  | "chose_competitor"
  | "doing_independently"
  | "pricing_too_high"
  | "timing_not_right"
  | "changed_plans"
  | "insufficient_funding"
  | "other"

export const DECLINE_REASON_OPTIONS = [
  { value: "chose_competitor", label: "Chose a competitor" },
  { value: "doing_independently", label: "Decided to do it independently" },
  { value: "pricing_too_high", label: "Pricing too high" },
  { value: "timing_not_right", label: "Timing not right" },
  { value: "changed_plans", label: "Changed plans (no longer pursuing acquisition)" },
  { value: "insufficient_funding", label: "Insufficient funding" },
  { value: "other", label: "Other" },
] as const

// Scoring accuracy ratings (post-interview manual assessment)
export type ScoringAccuracy = "understated" | "accurate" | "overstated"

export const SCORING_ACCURACY_OPTIONS = [
  { value: "understated", label: "Understated" },
  { value: "accurate", label: "Accurate" },
  { value: "overstated", label: "Overstated" },
] as const
export type JourneyStage = "explorer" | "learner" | "ready" | "execution" | "post_acquisition"
export type PersonaType = "first_time_buyer" | "serial_acquirer" | "corporate_spinoff" | "family_succession"

// Tier 2 Competency Dimension keys
export type Tier2DimensionKey =
  | "leadership"
  | "financial_acumen"
  | "communication"
  | "clarity_of_vision"
  | "coachability"
  | "commitment"

// Tier 2 Dimensions interface
export interface Tier2Dimensions {
  leadership: number | null
  financial_acumen: number | null
  communication: number | null
  clarity_of_vision: number | null
  coachability: number | null
  commitment: number | null
}

// Tier 3 Milestone keys (V2: 17 milestones in 4 transition groups)
export type MilestoneKey =
  // Group 1: Explorer → Learner
  | "decision_to_pursue"
  | "availability_confirmed"
  // Group 2: Learner → Ready
  | "target_profile_sheet"
  | "pitch_plan"
  | "equity_range"
  | "deal_breakers"
  | "leadership_assessment_passed"
  | "advisory_team_identified"
  // Group 3: Ready → Execution
  | "intermediary_meeting"
  | "seller_meeting"
  | "loi_issued"
  | "due_diligence"
  | "negotiation"
  | "financing_validated"
  | "closing"
  // Group 4: Execution → Post-acquisition
  | "plan_100_days"
  | "plan_3_years"

// Tier 3 Milestones interface (V2)
export interface Tier3Milestones {
  // Group 1: Explorer → Learner
  decision_to_pursue: boolean
  availability_confirmed: boolean
  // Group 2: Learner → Ready
  target_profile_sheet: boolean
  pitch_plan: boolean
  equity_range: boolean
  deal_breakers: boolean
  leadership_assessment_passed: boolean
  advisory_team_identified: boolean
  // Group 3: Ready → Execution
  intermediary_meeting: boolean
  seller_meeting: boolean
  loi_issued: boolean
  due_diligence: boolean
  negotiation: boolean
  financing_validated: boolean
  closing: boolean
  // Group 4: Execution → Post-acquisition
  plan_100_days: boolean
  plan_3_years: boolean
}

// Legacy milestone keys (kept for backwards compat, old columns still in DB)
export type LegacyMilestoneKey =
  | "investment_thesis"
  | "target_profile"
  | "first_intermediary"
  | "starter_pack"
  | "ldc_validated"
  | "financing_proof"
  | "advisory_team"
  | "search_plan"
  | "first_target"
  | "dd_checklist"
  | "first_acquisition"

// Persona options for the dropdown
export const PERSONA_OPTIONS = [
  { value: "first_time_buyer", label: "First-time buyer" },
  { value: "serial_acquirer", label: "Serial acquirer" },
  { value: "corporate_spinoff", label: "Corporate spin-off" },
  { value: "family_succession", label: "Family succession" },
] as const

// Source options for the dropdown
export const SOURCE_OPTIONS = [
  { value: "website_form", label: "Website Form" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "partner_intro", label: "Partner Intro" },
  { value: "event", label: "Event" },
  { value: "referral", label: "Referral" },
  { value: "inbound_email", label: "Inbound Email" },
  { value: "other", label: "Other" },
] as const

export type SourceType = typeof SOURCE_OPTIONS[number]["value"]

export interface Repreneur {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  linkedin_url?: string // LinkedIn profile URL
  avatar_url?: string // custom avatar URL, null = use default based on ID
  cv_url?: string // URL to CV document in Supabase Storage
  ldc_url?: string // URL to Lettre de Cadrage document in Supabase Storage
  flatchr_id?: string // Original ID from Flatchr import for deduplication
  company_background?: string
  investment_capacity?: string
  sector_preferences?: string[]
  target_location?: string[] // Multiple target regions (JSONB array)
  target_acquisition_size?: string
  lifecycle_status: LifecycleStatus
  journey_stage?: JourneyStage
  persona?: PersonaType // Acquisition style/profile type
  source?: string
  // GDPR Consent fields
  marketing_consent?: boolean
  consent_timestamp?: string
  consent_source?: string
  tier1_score?: number
  tier1_score_breakdown?: Record<string, number>
  tier2_stars?: number // 1-5 star rating, set manually after interview (legacy, kept for backwards compat)
  // Tier 2 Competency Dimensions (6 dimensions, each 1-5 stars)
  tier2_leadership?: number | null
  tier2_financial_acumen?: number | null
  tier2_communication?: number | null
  tier2_clarity_of_vision?: number | null
  tier2_coachability?: number | null
  tier2_commitment?: number | null
  tier2_overall?: number | null // Weighted average of all 6 dimensions
  tier2_rated_at?: string
  tier2_rated_by?: string
  // Tier 3 Readiness Milestones V2 (17 milestones in 4 groups)
  // Group 1: Explorer → Learner
  ms_decision_to_pursue?: boolean
  ms_availability_confirmed?: boolean
  // Group 2: Learner → Ready
  ms_target_profile_sheet?: boolean
  ms_pitch_plan?: boolean
  ms_equity_range?: boolean
  ms_deal_breakers?: boolean
  ms_leadership_assessment_passed?: boolean
  ms_advisory_team_identified?: boolean
  // Group 3: Ready → Execution
  ms_intermediary_meeting?: boolean
  ms_seller_meeting?: boolean
  ms_loi_issued?: boolean
  ms_due_diligence?: boolean
  ms_negotiation?: boolean
  ms_financing_validated?: boolean
  ms_closing?: boolean
  // Group 4: Execution → Post-acquisition
  ms_plan_100_days?: boolean
  ms_plan_3_years?: boolean
  tier3_milestone_count?: number // Computed count of completed milestones (0-18)
  // Legacy milestone columns (still in DB, read-only)
  ms_investment_thesis?: boolean
  ms_target_profile?: boolean
  ms_first_intermediary?: boolean
  ms_starter_pack?: boolean
  ms_ldc_validated?: boolean
  ms_financing_proof?: boolean
  ms_advisory_team?: boolean
  ms_search_plan?: boolean
  ms_first_target?: boolean
  ms_dd_checklist?: boolean
  ms_first_acquisition?: boolean
  rejected_at?: string // timestamp when rejected, null if not rejected
  declined_at?: string // timestamp when declined (internal decision, no email)
  decline_reason_category?: DeclineReasonCategory
  decline_reason_text?: string
  previous_status?: LifecycleStatus // status before rejection/decline, for restore
  // Scoring accuracy (post-interview manual assessment)
  who_accuracy?: ScoringAccuracy
  when_accuracy?: ScoringAccuracy
  accuracy_notes?: string
  accuracy_rated_at?: string
  accuracy_rated_by?: string
  // Questionnaire fields (Q1-Q17)
  q1_employment_status?: string
  q2_years_experience?: string
  q3_industry_sectors?: string[]
  q4_has_ma_experience?: boolean
  q5_team_size?: string
  q6_involved_in_ma?: boolean
  q7_ma_details?: string
  q8_executive_roles?: string[]
  q9_board_experience?: boolean
  q10_journey_stages?: string[]
  q11_target_sectors?: string[]
  q12_has_identified_targets?: boolean
  q13_target_details?: string
  q14_investment_capacity?: string
  q15_funding_status?: string
  q16_network_training?: string[]
  q17_open_to_co_acquisition?: boolean
  questionnaire_completed_at?: string
  // WHO/WHEN Dual Scoring (v2 questionnaire)
  // WHO answers (Q05-Q10)
  q05_status?: string // 'entrepreneur' | 'freelance' | 'employee' | 'transition' | 'other'
  q06_experience?: string // 'more_than_20' | '10_to_20' | 'less_than_10'
  q07_leadership?: string // 'general_management' | 'mgmt_over_10' | 'mgmt_under_10' | 'none'
  q08_crisis?: string // 'multiple' | 'once' | 'none'
  q09_investment?: string // 'both' | 'personal' | 'professional' | 'none'
  q10_impact?: string // 'financial' | 'trajectory' | 'limited' | 'none'
  // Q11 v3 priority choice (added 2026-04-23) — null for records from v2 questionnaire
  q11_priority_choice?: 'preferred' | 'one_among_others' | null
  // Q18 in Notion spec (code: q17) — current needs (multi-select)
  q17_current_needs?: string[]
  // WHEN answers (Q11-Q16)
  q11_project_status?: string[] // ['discovery' | 'exploratory' | 'framed' | 'searching' | 'loi']
  q12_geo_zones?: string[] // geographic zones (no scoring)
  q13_target_sectors_v2?: string[] // sectors (no scoring)
  q14_deal_size?: string[] // ['1-3M' | '3-5M' | '>5M']
  q15_structure?: string[] // ['majority_without_fund' | 'majority_with_minority' | 'manager_with_majority' | 'havent_thought']
  q16_equity?: string // 'tbd' | '151-250' | '251-350' | '351-450' | '>450'
  // Optional matching inputs; not part of the WHO/WHEN score.
  target_revenue_min_meur?: number | null
  target_revenue_max_meur?: number | null
  target_ebitda_margin_min_pct?: number | null
  target_staff_size_min?: number | null
  target_staff_size_max?: number | null
  // Dual score results
  who_score?: number // Profile quality (0-100)
  when_score?: number // Project maturity (0-100)
  who_score_breakdown?: Record<string, number> // { q05: 5, q06: 15, ... }
  when_score_breakdown?: Record<string, number> // { fitFinancier: 40, clarity: 40, projectStatus: 20 }
  scoring_flags?: string[] // ['F1', 'F3', ...]
  recommendation?: string // 'deal_flow' | 'priority_interview' | 'interview' | 'starter_pack'
  // Legacy migration flag
  needs_data_completion?: boolean // True if legacy repreneur needs manual data entry for dual scoring
  created_at: string
  updated_at: string
  created_by: string
}

export type NoteType = "call" | "email" | "meeting" | "other"

// Note type options for the dropdown
export const NOTE_TYPE_OPTIONS = [
  { value: "call", label: "Call", icon: "Phone" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "meeting", label: "Meeting", icon: "Users" },
  { value: "other", label: "Other", icon: "FileText" },
] as const

export interface Note {
  id: string
  repreneur_id: string
  content: string
  note_type: NoteType
  created_at: string
  created_by: string
  created_by_email?: string
}

export type ActivityType =
  | "welcome_email"
  | "interview"
  | "offer_submitted"
  | "offer_rejected"
  | "offer_approved"
  | "meeting"
  | "no_show"

export interface Activity {
  id: string
  repreneur_id: string
  activity_type: ActivityType
  notes?: string
  duration_minutes?: number // for future cost analytics
  event_date?: string // optional date for the event (e.g., interview date)
  created_at: string
  created_by: string
  created_by_email?: string
}

export interface Activity_Insert {
  repreneur_id: string
  activity_type: ActivityType
  notes?: string
  duration_minutes?: number
  event_date?: string
  created_by: string
}

export interface Repreneur_Insert {
  email: string
  first_name: string
  last_name: string
  phone?: string
  linkedin_url?: string
  avatar_url?: string
  cv_url?: string
  ldc_url?: string
  flatchr_id?: string
  company_background?: string
  investment_capacity?: string
  sector_preferences?: string[]
  target_location?: string[] // Multiple target regions (JSONB array)
  target_acquisition_size?: string
  lifecycle_status?: LifecycleStatus
  journey_stage?: JourneyStage
  persona?: PersonaType
  source?: string
  // GDPR Consent
  marketing_consent?: boolean
  consent_timestamp?: string
  consent_source?: string
  tier1_score?: number
  tier2_stars?: number
  rejected_at?: string
  declined_at?: string
  decline_reason_category?: DeclineReasonCategory
  decline_reason_text?: string
  previous_status?: LifecycleStatus
  // WHO/WHEN Dual Scoring (v2 questionnaire)
  q05_status?: string
  q06_experience?: string
  q07_leadership?: string
  q08_crisis?: string
  q09_investment?: string
  q10_impact?: string
  q11_priority_choice?: 'preferred' | 'one_among_others' | null
  q11_project_status?: string[]
  q12_geo_zones?: string[]
  q13_target_sectors_v2?: string[]
  q14_deal_size?: string[]
  q15_structure?: string[]
  q16_equity?: string
  target_revenue_min_meur?: number | null
  target_revenue_max_meur?: number | null
  target_ebitda_margin_min_pct?: number | null
  target_staff_size_min?: number | null
  target_staff_size_max?: number | null
  who_score?: number
  when_score?: number
  who_score_breakdown?: Record<string, number>
  when_score_breakdown?: Record<string, number>
  scoring_flags?: string[]
  recommendation?: string
  needs_data_completion?: boolean
  created_by: string
}

// Required fields that Bertrand needs to fill in for imported repreneurs
export const REQUIRED_FIELDS = ["email", "phone"] as const

export type MissingField = typeof REQUIRED_FIELDS[number]

/**
 * Check which required fields are missing from a repreneur
 * Used to show "needs attention" badge on imported records
 */
export function getMissingFields(repreneur: Partial<Repreneur>): MissingField[] {
  const missing: MissingField[] = []

  if (!repreneur.email || repreneur.email.trim() === "") {
    missing.push("email")
  }
  if (!repreneur.phone || repreneur.phone.trim() === "") {
    missing.push("phone")
  }

  return missing
}

/**
 * Check if repreneur has any missing required fields
 */
export function hasMissingFields(repreneur: Partial<Repreneur>): boolean {
  return getMissingFields(repreneur).length > 0
}
