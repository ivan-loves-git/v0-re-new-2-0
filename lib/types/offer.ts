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
}

export interface RepreneurOffer_Insert {
  repreneur_id: string
  offer_id: string
  status?: OfferStatus
  created_by: string
}
