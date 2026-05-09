/**
 * Leadership Assessment Types
 * 26-question assessment across 3 blocks
 */

// Bloc A: Binary A/B choices (leadership profile, no right/wrong)
export type BlocAAnswer = "A" | "B"

// Bloc B: 4-option scenarios (scored +2/+1/0/-2)
export type BlocBAnswer = "A" | "B" | "C" | "D"

// Bloc C: Likert 1-5 scale
export type BlocCAnswer = 1 | 2 | 3 | 4 | 5

// Bloc A Radar: 4 axes with opposing poles
export interface BlocARadar {
  drive: number
  prudence: number
  autorite: number
  collectif: number
  controle: number
  delegation: number
  court_terme: number
  long_terme: number
}

// Bloc B Result
export interface BlocBResult {
  total: number // -16 to +16
  tags: string[]
  minus2Count: number
}

// Bloc C Result
export interface BlocCResult {
  riskIndex: number // mean of critical items (inverse-scored C1, C3, C5)
  scores: Record<string, number> // all 8 corrected scores
}

// Decision outcome
export type LeadershipDecision = "engagement" | "engagement_sous_conditions" | "non_engagement"

// Full assessment result (team-only)
export interface LeadershipResult {
  blocA: BlocARadar
  blocB: BlocBResult
  blocC: BlocCResult
  decision: LeadershipDecision
}

// Form data collected from repreneur
export interface LeadershipFormData {
  // Bloc A answers
  a1?: BlocAAnswer
  a2?: BlocAAnswer
  a3?: BlocAAnswer
  a4?: BlocAAnswer
  a5?: BlocAAnswer
  a6?: BlocAAnswer
  a7?: BlocAAnswer
  a8?: BlocAAnswer
  a9?: BlocAAnswer
  a10?: BlocAAnswer
  // Bloc B answers
  b1?: BlocBAnswer
  b2?: BlocBAnswer
  b3?: BlocBAnswer
  b4?: BlocBAnswer
  b5?: BlocBAnswer
  b6?: BlocBAnswer
  b7?: BlocBAnswer
  b8?: BlocBAnswer
  // Bloc C answers
  c1?: BlocCAnswer
  c2?: BlocCAnswer
  c3?: BlocCAnswer
  c4?: BlocCAnswer
  c5?: BlocCAnswer
  c6?: BlocCAnswer
  c7?: BlocCAnswer
  c8?: BlocCAnswer
}

// Form state for the multi-step form
export interface LeadershipFormState {
  currentStep: number // 1=BlocA, 2=BlocB, 3=BlocC, 4=Review
  data: LeadershipFormData
  errors: Record<string, string>
  isSubmitting: boolean
  submitResult: { success: boolean; error?: string } | null
}

// Database row
export interface LeadershipAssessment {
  id: string
  repreneur_id: string
  token: string
  // Answers
  a1: BlocAAnswer | null
  a2: BlocAAnswer | null
  a3: BlocAAnswer | null
  a4: BlocAAnswer | null
  a5: BlocAAnswer | null
  a6: BlocAAnswer | null
  a7: BlocAAnswer | null
  a8: BlocAAnswer | null
  a9: BlocAAnswer | null
  a10: BlocAAnswer | null
  b1: BlocBAnswer | null
  b2: BlocBAnswer | null
  b3: BlocBAnswer | null
  b4: BlocBAnswer | null
  b5: BlocBAnswer | null
  b6: BlocBAnswer | null
  b7: BlocBAnswer | null
  b8: BlocBAnswer | null
  c1: number | null
  c2: number | null
  c3: number | null
  c4: number | null
  c5: number | null
  c6: number | null
  c7: number | null
  c8: number | null
  // Computed scores
  bloc_a_radar: BlocARadar | null
  bloc_b_total: number | null
  bloc_b_tags: string[] | null
  bloc_b_minus2_count: number | null
  bloc_c_risk_index: number | null
  decision: LeadershipDecision | null
  // Metadata
  completed_at: string | null
  created_at: string
  sent_by: string | null
}

// Step props shared by all step components
export interface AssessmentStepProps {
  data: LeadershipFormData
  onChange: (updates: Partial<LeadershipFormData>) => void
  onNext: () => void
  onBack?: () => void
  errors: Record<string, string>
  isSubmitting: boolean
}
