export type LifecycleStatus = "lead" | "qualified" | "client" | "rejected"
export type JourneyStage = "explorer" | "learner" | "ready" | "serial_acquirer"

export interface Repreneur {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  company_background?: string
  investment_capacity?: string
  sector_preferences?: string[]
  target_location?: string
  target_acquisition_size?: string
  lifecycle_status: LifecycleStatus
  journey_stage?: JourneyStage
  source?: string
  tier1_score?: number
  tier2_stars?: number // 1-5 star rating, set manually after interview
  rejected_at?: string // timestamp when rejected, null if not rejected
  previous_status?: LifecycleStatus // status before rejection, for un-reject
  created_at: string
  updated_at: string
  created_by: string
}

export interface Note {
  id: string
  repreneur_id: string
  content: string
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
  company_background?: string
  investment_capacity?: string
  sector_preferences?: string[]
  target_location?: string
  target_acquisition_size?: string
  lifecycle_status?: LifecycleStatus
  journey_stage?: JourneyStage
  source?: string
  tier1_score?: number
  tier2_stars?: number
  rejected_at?: string
  previous_status?: LifecycleStatus
  created_by: string
}
