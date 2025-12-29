export type LifecycleStatus = "lead" | "qualified" | "client"
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
  created_by: string
}
