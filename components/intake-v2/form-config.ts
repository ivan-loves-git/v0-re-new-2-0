/**
 * TanStack Form Configuration + Zod Schemas
 *
 * Centralized form configuration for the v2 intake form.
 * Uses Zod for validation with TanStack Form for state management.
 */

import { z } from "zod"

// =====================
// ZOD SCHEMAS PER STEP
// =====================

export const step1Schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional().refine(
    (val) => !val || /^[\d\s\-+().]{7,20}$/.test(val),
    "Please enter a valid phone number"
  ),
  linkedin_url: z.string().optional().refine(
    (val) => !val || /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w\-]+\/?$|^[\w\-]+$/.test(val),
    "Please enter a valid LinkedIn URL"
  ),
})

export const step2Schema = z.object({
  q1_employment_status: z.string().min(1, "Please select your employment status"),
  q2_years_experience: z.string().min(1, "Please select your experience level"),
  q3_industry_sectors: z.array(z.string()).min(1, "Please select at least one industry"),
  q5_team_size: z.string().min(1, "Please select a team size"),
  q8_executive_roles: z.array(z.string()).min(1, "Please select at least one role"),
})

export const step3Schema = z.object({
  q4_has_ma_experience: z.boolean({ required_error: "Please select Yes or No" }),
  q6_involved_in_ma: z.boolean({ required_error: "Please select Yes or No" }),
  q7_ma_details: z.string().nullable().optional(),
  q9_board_experience: z.boolean({ required_error: "Please select Yes or No" }),
})

export const step4Schema = z.object({
  q10_journey_stages: z.array(z.string()).min(1, "Please select at least one stage"),
  q11_target_sectors: z.array(z.string()).min(1, "Please select at least one sector"),
  target_location: z.string().nullable().optional(),
  target_acquisition_size: z.string().nullable().optional(),
  q12_has_identified_targets: z.boolean().nullable().optional(),
  q13_target_details: z.string().nullable().optional(),
})

export const step5Schema = z.object({
  q14_investment_capacity: z.string().min(1, "Please select your investment capacity"),
  q15_funding_status: z.string().min(1, "Please select your funding status"),
  q16_network_training: z.array(z.string()).optional(),
  q17_open_to_co_acquisition: z.boolean({ required_error: "Please select Yes or No" }),
  source: z.string().nullable().optional(),
  marketing_consent: z.boolean({ required_error: "Please confirm your consent" }),
})

// Combined schema for all form data
export const fullFormSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)

// =====================
// TYPES
// =====================

export type IntakeFormData = z.infer<typeof fullFormSchema>

// Step schema mapping for validation
export const stepSchemas = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
  5: step5Schema,
} as const

// =====================
// INITIAL VALUES
// =====================

export function getInitialFormValues(): IntakeFormData {
  return {
    // Step 1 - Contact
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    linkedin_url: "",

    // Step 2 - Background
    q1_employment_status: "",
    q2_years_experience: "",
    q3_industry_sectors: [],
    q5_team_size: "",
    q8_executive_roles: [],

    // Step 3 - M&A Experience
    q4_has_ma_experience: undefined as unknown as boolean,
    q6_involved_in_ma: undefined as unknown as boolean,
    q7_ma_details: null,
    q9_board_experience: undefined as unknown as boolean,

    // Step 4 - Goals
    q10_journey_stages: [],
    q11_target_sectors: [],
    target_location: null,
    target_acquisition_size: null,
    q12_has_identified_targets: null,
    q13_target_details: null,

    // Step 5 - Financial
    q14_investment_capacity: "",
    q15_funding_status: "",
    q16_network_training: [],
    q17_open_to_co_acquisition: undefined as unknown as boolean,
    source: null,
    marketing_consent: undefined as unknown as boolean,
  }
}

// =====================
// STEP VALIDATION
// =====================

export function validateStep(step: number, data: Partial<IntakeFormData>): { success: boolean; errors: Record<string, string> } {
  const schema = stepSchemas[step as keyof typeof stepSchemas]
  if (!schema) return { success: true, errors: {} }

  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, errors: {} }
  }

  const errors: Record<string, string> = {}
  result.error.errors.forEach((err) => {
    const path = err.path.join(".")
    errors[path] = err.message
  })

  return { success: false, errors }
}

// =====================
// STORAGE KEY
// =====================

export const FORM_STORAGE_KEY = "renew-intake-v2-draft"
export const STEP_STORAGE_KEY = "renew-intake-v2-step"
