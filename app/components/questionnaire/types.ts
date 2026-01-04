/**
 * Shared types for questionnaire components
 */

// Form data shape matching database fields
export interface QuestionnaireFormData {
  // Contact (intake only)
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  linkedin_url?: string

  // Q1-Q17 questionnaire fields
  q1_employment_status: string | null
  q2_years_experience: string | null
  q3_industry_sectors: string[]
  q4_has_ma_experience: boolean | null
  q5_team_size: string | null
  q6_involved_in_ma: boolean | null
  q7_ma_details: string | null
  q8_executive_roles: string[]
  q9_board_experience: boolean | null
  q10_journey_stages: string[]
  q11_target_sectors: string[]
  q12_has_identified_targets: boolean | null
  q13_target_details: string | null
  q14_investment_capacity: string | null
  q15_funding_status: string | null
  q16_network_training: string[]
  q17_open_to_co_acquisition: boolean | null

  // Intake-only fields
  target_location?: string | null
  target_acquisition_size?: string | null
  marketing_consent?: boolean
  source?: string | null
}

// Question types
export type QuestionType =
  | "radio"       // Single select with radio buttons
  | "checkbox"    // Multi-select with checkboxes
  | "yes-no"      // Boolean yes/no buttons
  | "text"        // Text input
  | "textarea"    // Multi-line text
  | "select"      // Dropdown select

// Single option definition
export interface QuestionOption {
  value: string
  label: string
  score?: number
}

// Question definition
export interface QuestionConfig {
  id: string                              // Field name in formData
  label: string                           // Display label
  type: QuestionType
  options?: readonly QuestionOption[] | QuestionOption[]
  required?: boolean
  placeholder?: string
  rows?: number                           // For textarea
  showIf?: (data: QuestionnaireFormData) => boolean  // Conditional display
  icon?: string                           // Icon name for styled display
}

// Step definition
export interface StepConfig {
  id: number
  title: string
  description: string
  icon: string
  questions: QuestionConfig[]
}

// Form update handlers
export interface FormHandlers {
  updateField: <K extends keyof QuestionnaireFormData>(
    field: K,
    value: QuestionnaireFormData[K]
  ) => void
  toggleArrayField: (field: keyof QuestionnaireFormData, value: string) => void
}

// Validation error map
export type FieldErrors = Partial<Record<keyof QuestionnaireFormData, string>>
