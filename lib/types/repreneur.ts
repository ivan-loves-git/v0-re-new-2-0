export type LifecycleStatus = "lead" | "qualified" | "client" | "rejected"
export type JourneyStage = "explorer" | "learner" | "ready" | "serial_acquirer"
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

// Tier 3 Milestone keys
export type MilestoneKey =
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

// Tier 3 Milestones interface
export interface Tier3Milestones {
  investment_thesis: boolean
  target_profile: boolean
  first_intermediary: boolean
  starter_pack: boolean
  ldc_validated: boolean
  financing_proof: boolean
  advisory_team: boolean
  search_plan: boolean
  first_target: boolean
  dd_checklist: boolean
}

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
  target_location?: string
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
  // Tier 3 Readiness Milestones (10 checkboxes)
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
  tier3_milestone_count?: number // Computed count of completed milestones (0-10)
  rejected_at?: string // timestamp when rejected, null if not rejected
  previous_status?: LifecycleStatus // status before rejection, for un-reject
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

export interface Activity {
  id: string
  repreneur_id: string
  activity_type: ActivityType
  notes?: string
  duration_minutes?: number // for future cost analytics
  created_at: string
  created_by: string
  created_by_email?: string
}

export interface Activity_Insert {
  repreneur_id: string
  activity_type: ActivityType
  notes?: string
  duration_minutes?: number
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
  target_location?: string
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
  previous_status?: LifecycleStatus
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
