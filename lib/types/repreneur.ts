export type LifecycleStatus = "lead" | "qualified" | "client" | "rejected"
export type JourneyStage = "explorer" | "learner" | "ready" | "serial_acquirer"
export type PersonaType = "first_time_buyer" | "serial_acquirer" | "corporate_spinoff" | "family_succession"

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
  tier2_stars?: number // 1-5 star rating, set manually after interview
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
