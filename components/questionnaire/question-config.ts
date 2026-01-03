/**
 * Centralized question configuration for the questionnaire
 * Used by both public intake and internal questionnaire forms
 */

import type { QuestionConfig, StepConfig, QuestionnaireFormData } from "./types"
import {
  EMPLOYMENT_STATUS_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  EXECUTIVE_ROLE_OPTIONS,
  JOURNEY_STAGE_OPTIONS,
  INVESTMENT_CAPACITY_OPTIONS,
  FUNDING_STATUS_OPTIONS,
  NETWORK_TRAINING_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS,
  TARGET_ACQUISITION_SIZE_OPTIONS,
  TARGET_LOCATION_OPTIONS,
} from "@/lib/utils/tier1-scoring"
import { SOURCE_OPTIONS } from "@/lib/types/repreneur"

// =====================
// QUESTION DEFINITIONS
// =====================

// Contact questions (intake only)
export const CONTACT_QUESTIONS: QuestionConfig[] = [
  {
    id: "first_name",
    label: "First Name",
    type: "text",
    required: true,
    placeholder: "John",
    icon: "User",
  },
  {
    id: "last_name",
    label: "Last Name",
    type: "text",
    required: true,
    placeholder: "Doe",
    icon: "User",
  },
  {
    id: "email",
    label: "Email Address",
    type: "text",
    required: true,
    placeholder: "john@example.com",
    icon: "Mail",
  },
  {
    id: "phone",
    label: "Phone",
    type: "text",
    placeholder: "+33 6 12 34 56 78",
    icon: "Phone",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn",
    type: "text",
    placeholder: "linkedin.com/in/johndoe",
    icon: "Linkedin",
  },
]

// Background questions (shared)
export const BACKGROUND_QUESTIONS: QuestionConfig[] = [
  {
    id: "q1_employment_status",
    label: "Current Employment Status",
    type: "radio",
    options: EMPLOYMENT_STATUS_OPTIONS,
    required: true,
    icon: "Briefcase",
  },
  {
    id: "q2_years_experience",
    label: "Years of Professional Experience",
    type: "radio",
    options: YEARS_EXPERIENCE_OPTIONS,
    required: true,
    icon: "Award",
  },
  {
    id: "q3_industry_sectors",
    label: "Industry Experience (select all that apply)",
    type: "checkbox",
    options: INDUSTRY_SECTOR_OPTIONS,
    required: true,
    icon: "Building2",
  },
  {
    id: "q5_team_size",
    label: "Largest Team Size Managed",
    type: "radio",
    options: TEAM_SIZE_OPTIONS,
    required: true,
    icon: "Users",
  },
  {
    id: "q8_executive_roles",
    label: "Executive Roles Held (select all that apply)",
    type: "checkbox",
    options: EXECUTIVE_ROLE_OPTIONS,
    required: true,
    icon: "Award",
  },
]

// M&A Experience questions (shared)
export const MA_EXPERIENCE_QUESTIONS: QuestionConfig[] = [
  {
    id: "q4_has_ma_experience",
    label: "Do you have M&A experience?",
    type: "yes-no",
    required: true,
    icon: "Scale",
  },
  {
    id: "q6_involved_in_ma",
    label: "Have you been directly involved in M&A transactions?",
    type: "yes-no",
    required: true,
  },
  {
    id: "q7_ma_details",
    label: "Please describe your M&A experience (optional)",
    type: "textarea",
    placeholder: "Describe your involvement in acquisitions, sales, or other M&A transactions...",
    rows: 4,
    showIf: (data: QuestionnaireFormData) =>
      data.q4_has_ma_experience === true || data.q6_involved_in_ma === true,
  },
  {
    id: "q9_board_experience",
    label: "Do you have board or advisory experience?",
    type: "yes-no",
    required: true,
  },
]

// Goals questions (shared, with some intake-only fields)
export const GOALS_QUESTIONS: QuestionConfig[] = [
  {
    id: "q10_journey_stages",
    label: "Where are you in your acquisition journey? (select all that apply)",
    type: "checkbox",
    options: JOURNEY_STAGE_OPTIONS,
    required: true,
    icon: "Target",
  },
  {
    id: "q11_target_sectors",
    label: "Target Acquisition Sectors (select all that apply)",
    type: "checkbox",
    options: INDUSTRY_SECTOR_OPTIONS,
    required: true,
    icon: "Building2",
  },
  {
    id: "q12_has_identified_targets",
    label: "Have you identified specific acquisition targets?",
    type: "yes-no",
  },
  {
    id: "q13_target_details",
    label: "Describe your identified targets (optional)",
    type: "textarea",
    placeholder: "Revenue range, number of employees, sector, valuation...",
    rows: 4,
    showIf: (data: QuestionnaireFormData) => data.q12_has_identified_targets === true,
  },
]

// Intake-only goals fields
export const GOALS_QUESTIONS_INTAKE_EXTRA: QuestionConfig[] = [
  {
    id: "target_location",
    label: "Target Location",
    type: "radio",
    options: TARGET_LOCATION_OPTIONS,
    icon: "MapPin",
  },
  {
    id: "target_acquisition_size",
    label: "Target Acquisition Size",
    type: "radio",
    options: TARGET_ACQUISITION_SIZE_OPTIONS,
    icon: "Euro",
  },
]

// Financial questions (shared)
export const FINANCIAL_QUESTIONS: QuestionConfig[] = [
  {
    id: "q14_investment_capacity",
    label: "Investment Capacity",
    type: "radio",
    options: INVESTMENT_CAPACITY_OPTIONS,
    required: true,
    icon: "Wallet",
  },
  {
    id: "q15_funding_status",
    label: "Funding Status",
    type: "radio",
    options: FUNDING_STATUS_OPTIONS,
    required: true,
    icon: "Euro",
  },
  {
    id: "q16_network_training",
    label: "Network or Training Affiliations (select all that apply)",
    type: "checkbox",
    options: NETWORK_TRAINING_OPTIONS,
    icon: "GraduationCap",
  },
  {
    id: "q17_open_to_co_acquisition",
    label: "Open to co-acquisition?",
    type: "yes-no",
    required: true,
    icon: "Handshake",
  },
]

// Intake-only final fields
export const INTAKE_FINAL_QUESTIONS: QuestionConfig[] = [
  {
    id: "source",
    label: "How did you hear about Re-New? (optional)",
    type: "radio",
    options: SOURCE_OPTIONS,
  },
  {
    id: "marketing_consent",
    label: "I agree to receive communications from Re-New",
    type: "yes-no",
    required: true,
  },
]

// =====================
// STEP CONFIGURATIONS
// =====================

// Steps for public intake form (5 steps)
export const INTAKE_STEPS: StepConfig[] = [
  {
    id: 1,
    title: "Welcome",
    description: "Let's start with your contact information",
    icon: "User",
    questions: CONTACT_QUESTIONS,
  },
  {
    id: 2,
    title: "Background",
    description: "Tell us about your professional experience",
    icon: "Briefcase",
    questions: BACKGROUND_QUESTIONS,
  },
  {
    id: 3,
    title: "M&A Experience",
    description: "Your mergers & acquisitions background",
    icon: "Scale",
    questions: MA_EXPERIENCE_QUESTIONS,
  },
  {
    id: 4,
    title: "Goals",
    description: "What are you looking for?",
    icon: "Target",
    questions: [...GOALS_QUESTIONS.slice(0, 2), ...GOALS_QUESTIONS_INTAKE_EXTRA, ...GOALS_QUESTIONS.slice(2)],
  },
  {
    id: 5,
    title: "Financial",
    description: "Investment capacity & final details",
    icon: "Wallet",
    questions: [...FINANCIAL_QUESTIONS, ...INTAKE_FINAL_QUESTIONS],
  },
]

// Steps for internal questionnaire (4 steps, no contact)
export const INTERNAL_STEPS: StepConfig[] = [
  {
    id: 1,
    title: "Professional Background",
    description: "Employment and experience information",
    icon: "Briefcase",
    questions: BACKGROUND_QUESTIONS,
  },
  {
    id: 2,
    title: "M&A Experience",
    description: "Mergers & acquisitions background",
    icon: "Scale",
    questions: MA_EXPERIENCE_QUESTIONS,
  },
  {
    id: 3,
    title: "Acquisition Journey",
    description: "Goals and target information",
    icon: "Target",
    questions: GOALS_QUESTIONS,
  },
  {
    id: 4,
    title: "Financial & Network",
    description: "Investment capacity and affiliations",
    icon: "Wallet",
    questions: FINANCIAL_QUESTIONS,
  },
]

// =====================
// VALIDATION HELPERS
// =====================

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true
  const phoneRegex = /^[\d\s\-+().]{7,20}$/
  return phoneRegex.test(phone)
}

export const isValidLinkedIn = (url: string): boolean => {
  if (!url) return true
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w\-]+\/?$|^[\w\-]+$/
  return linkedinRegex.test(url)
}

/**
 * Validate a single step's required questions
 */
export function validateStep(
  step: StepConfig,
  formData: QuestionnaireFormData
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const question of step.questions) {
    // Skip if conditional and condition not met
    if (question.showIf && !question.showIf(formData)) {
      continue
    }

    if (!question.required) continue

    const value = formData[question.id as keyof QuestionnaireFormData]

    switch (question.type) {
      case "text":
        if (!value || (typeof value === "string" && !value.trim())) {
          errors[question.id] = `${question.label} is required`
        }
        // Special validation for email
        if (question.id === "email" && value && !isValidEmail(value as string)) {
          errors[question.id] = "Please enter a valid email address"
        }
        if (question.id === "phone" && value && !isValidPhone(value as string)) {
          errors[question.id] = "Please enter a valid phone number"
        }
        if (question.id === "linkedin_url" && value && !isValidLinkedIn(value as string)) {
          errors[question.id] = "Please enter a valid LinkedIn URL"
        }
        break

      case "radio":
      case "select":
        if (value === null || value === undefined || value === "") {
          errors[question.id] = `Please select an option`
        }
        break

      case "checkbox":
        if (!Array.isArray(value) || value.length === 0) {
          errors[question.id] = `Please select at least one option`
        }
        break

      case "yes-no":
        if (value === null || value === undefined) {
          errors[question.id] = `Please select Yes or No`
        }
        break
    }
  }

  return errors
}

/**
 * Check if a step is complete (all required fields filled)
 */
export function isStepComplete(
  step: StepConfig,
  formData: QuestionnaireFormData
): boolean {
  const errors = validateStep(step, formData)
  return Object.keys(errors).length === 0
}

/**
 * Get initial empty form data
 */
export function getInitialFormData(): QuestionnaireFormData {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    q1_employment_status: null,
    q2_years_experience: null,
    q3_industry_sectors: [],
    q4_has_ma_experience: null,
    q5_team_size: null,
    q6_involved_in_ma: null,
    q7_ma_details: null,
    q8_executive_roles: [],
    q9_board_experience: null,
    q10_journey_stages: [],
    q11_target_sectors: [],
    q12_has_identified_targets: null,
    q13_target_details: null,
    q14_investment_capacity: null,
    q15_funding_status: null,
    q16_network_training: [],
    q17_open_to_co_acquisition: null,
    target_location: null,
    target_acquisition_size: null,
    marketing_consent: false,
    source: null,
  }
}
