/**
 * Intake Form V2 - Type Definitions
 *
 * Types for the multi-step intake form based on questionnaire-spec-v2.md
 */

// ========================================
// Form Data Interface
// ========================================

/**
 * Complete form data for intake v2.
 * Maps to database columns and scoring inputs.
 */
export interface IntakeV2FormData {
  // Step 1: Contact Information (Q01-Q04)
  first_name: string
  last_name: string
  email: string
  phone: string
  cv_url: string | null
  linkedin_url: string | null

  // Step 2: WHO Questions (Q05-Q10)
  q05_status: string      // 'entrepreneur' | 'freelance' | 'employee' | 'transition' | 'other'
  q06_experience: string  // 'more_than_20' | '10_to_20' | 'less_than_10'
  q07_leadership: string  // 'general_management' | 'mgmt_over_10' | 'mgmt_under_10' | 'none'
  q08_crisis: string      // 'multiple' | 'once' | 'none'
  q09_investment: string  // 'both' | 'personal' | 'professional' | 'none'
  q10_impact: string      // 'financial' | 'trajectory' | 'limited' | 'none'

  // Step 3: Project Status (Q11)
  q11_project_status: string[]  // Multi-select: ['discovery', 'exploratory', 'framed', 'searching', 'loi']

  // Step 4: WHEN Questions (Q12-Q16)
  q12_geo_zones: string[]           // Multi-select: geographic zones
  q13_target_sectors_v2: string[]   // Multi-select: sector identifiers
  q14_deal_size: string[]           // Multi-select: ['1-3M', '3-5M', '>5M']
  q15_structure: string[]           // Multi-select: capital structure options
  q16_equity: string                // Single: 'tbd' | '151-250' | '251-350' | '351-450' | '>450'

  // Step 5: Needs Assessment (Q17-Q18)
  q17_current_needs: string[]       // Multi-select: need categories
  q18_investment_thesis_url: string | null  // Optional file URL

  // Consent
  marketing_consent: boolean
}

/**
 * Initial empty form data
 */
export const EMPTY_INTAKE_FORM: IntakeV2FormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  cv_url: null,
  linkedin_url: null,
  q05_status: '',
  q06_experience: '',
  q07_leadership: '',
  q08_crisis: '',
  q09_investment: '',
  q10_impact: '',
  q11_project_status: [],
  q12_geo_zones: [],
  q13_target_sectors_v2: [],
  q14_deal_size: [],
  q15_structure: [],
  q16_equity: '',
  q17_current_needs: [],
  q18_investment_thesis_url: null,
  marketing_consent: false
}

// ========================================
// Step Component Props
// ========================================

/**
 * Common props for all step components
 */
export interface IntakeV2StepProps {
  /** Current form data (partial during multi-step) */
  data: Partial<IntakeV2FormData>
  /** Update form data */
  onChange: (updates: Partial<IntakeV2FormData>) => void
  /** Navigate to next step */
  onNext: () => void
  /** Navigate to previous step (not available on step 1) */
  onBack?: () => void
  /** Whether form is currently submitting */
  isSubmitting?: boolean
  /** Validation errors for current step */
  errors?: Record<string, string>
}

/**
 * Props for the review step (step 6)
 */
export interface IntakeV2ReviewStepProps extends IntakeV2StepProps {
  /** Navigate to specific step for editing */
  onEditStep: (stepNumber: number) => void
  /** Submit the complete form */
  onSubmit: () => void
}

// ========================================
// Form State
// ========================================

/**
 * Overall form state managed by orchestrator
 */
export interface IntakeV2FormState {
  /** Current step (1-6) */
  currentStep: number
  /** Form data accumulated across steps */
  data: Partial<IntakeV2FormData>
  /** Validation errors by field */
  errors: Record<string, string>
  /** Whether form is submitting */
  isSubmitting: boolean
  /** Submission result */
  submitResult: {
    success: boolean
    repreneurId?: string
    error?: string
  } | null
}

/**
 * Initial form state
 */
export const INITIAL_FORM_STATE: IntakeV2FormState = {
  currentStep: 1,
  data: {},
  errors: {},
  isSubmitting: false,
  submitResult: null
}

// ========================================
// Validation
// ========================================

/**
 * Validation result for a step
 */
export interface StepValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * Step validation functions type
 */
export type StepValidator = (data: Partial<IntakeV2FormData>) => StepValidationResult

// ========================================
// File Upload
// ========================================

/**
 * File upload state
 */
export interface FileUploadState {
  file: File | null
  uploading: boolean
  progress: number
  url: string | null
  error: string | null
}

/**
 * Accepted file types for uploads
 */
export const ACCEPTED_FILE_TYPES = {
  cv: {
    accept: '.pdf,.doc,.docx',
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  thesis: {
    accept: '.pdf,.doc,.docx',
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 10 * 1024 * 1024 // 10MB
  }
} as const

// ========================================
// Submission
// ========================================

/**
 * Result from form submission
 */
export interface IntakeV2SubmissionResult {
  success: boolean
  repreneurId?: string
  whoScore?: number
  whenScore?: number
  recommendation?: string
  error?: string
}

/**
 * Data sent to server action
 */
export interface IntakeV2SubmissionData extends IntakeV2FormData {
  /** Source of the submission */
  source: 'intake_v2'
  /** Consent timestamp */
  consent_timestamp: string
  /** Consent source */
  consent_source: 'intake_form_v2'
}
