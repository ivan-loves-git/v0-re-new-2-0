export type OfferStatus = "offered" | "accepted" | "active" | "completed" | "expired"

export interface Offer {
  id: string
  name: string
  description?: string
  price: number
  duration_days: number
  acceptance_deadline_days?: number
  includes_hours?: number
  includes_resources: boolean
  is_active: boolean
  created_at: string
}

export interface Offer_Insert {
  name: string
  description?: string
  price: number
  duration_days: number
  acceptance_deadline_days?: number
  includes_hours?: number
  includes_resources?: boolean
  is_active?: boolean
}

export interface RepreneurOffer {
  id: string
  repreneur_id: string
  offer_id: string
  status: OfferStatus
  offered_at: string
  accepted_at?: string
  expires_at?: string
  created_by: string
  offer?: Offer
  repreneur?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  milestones?: OfferMilestone[]
}

export interface RepreneurOffer_Insert {
  repreneur_id: string
  offer_id: string
  status?: OfferStatus
  created_by: string
}

// Milestone types for tracking deliverables and checkpoints
export type MilestoneType = "deliverable" | "checkpoint"

export interface OfferMilestone {
  id: string
  repreneur_offer_id: string
  milestone_type: MilestoneType
  title: string
  notes?: string
  is_completed: boolean
  completed_at?: string
  due_date?: string
  created_at: string
  created_by: string
  created_by_email?: string
}

export interface OfferMilestone_Insert {
  repreneur_offer_id: string
  milestone_type: MilestoneType
  title: string
  notes?: string
  due_date?: string
  created_by: string
}
