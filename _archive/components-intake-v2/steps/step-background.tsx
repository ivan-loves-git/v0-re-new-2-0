"use client"

import { motion } from "framer-motion"
import { RadioOptionGrid, CheckboxGrid } from "@/components/questionnaire/question-inputs"
import type { StepConfig } from "@/components/questionnaire/types"
import { AlertCircle } from "lucide-react"

interface StepBackgroundProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any // TanStack Form instance
  stepConfig: StepConfig
  fieldErrors?: Record<string, string> // External validation errors from Zod
}

// Styled question wrapper with label
function QuestionWrapper({
  label,
  required,
  error,
  children,
  delay = 0,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="space-y-3"
    >
      <label className="text-base font-semibold text-gray-900 block">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-sm text-red-500"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.p>
      )}
    </motion.div>
  )
}

/**
 * Step 2: Professional Background
 */
export function StepBackground({ form, stepConfig, fieldErrors = {} }: StepBackgroundProps) {
  // Get options from step config
  const q1Options = stepConfig.questions.find(q => q.id === "q1_employment_status")?.options ?? []
  const q2Options = stepConfig.questions.find(q => q.id === "q2_years_experience")?.options ?? []
  const q3Options = stepConfig.questions.find(q => q.id === "q3_industry_sectors")?.options ?? []
  const q5Options = stepConfig.questions.find(q => q.id === "q5_team_size")?.options ?? []
  const q8Options = stepConfig.questions.find(q => q.id === "q8_executive_roles")?.options ?? []

  return (
    <div className="space-y-8">
      {/* Q1: Employment Status */}
      <form.Field name="q1_employment_status">
        {(field: any) => (
          <QuestionWrapper
            label="Current Employment Status"
            required
            error={fieldErrors.q1_employment_status}
            delay={0.1}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={q1Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q2: Years Experience */}
      <form.Field name="q2_years_experience">
        {(field: any) => (
          <QuestionWrapper
            label="Years of Professional Experience"
            required
            error={fieldErrors.q2_years_experience}
            delay={0.15}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={q2Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q3: Industry Sectors */}
      <form.Field name="q3_industry_sectors">
        {(field: any) => (
          <QuestionWrapper
            label="Industry Experience (select all that apply)"
            required
            error={fieldErrors.q3_industry_sectors}
            delay={0.2}
          >
            <CheckboxGrid
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
              options={q3Options}
              variant="styled"
              columns={2}
              maxHeight="320px"
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q5: Team Size */}
      <form.Field name="q5_team_size">
        {(field: any) => (
          <QuestionWrapper
            label="Largest Team Size Managed"
            required
            error={fieldErrors.q5_team_size}
            delay={0.25}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={q5Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q8: Executive Roles */}
      <form.Field name="q8_executive_roles">
        {(field: any) => (
          <QuestionWrapper
            label="Executive Roles Held (select all that apply)"
            required
            error={fieldErrors.q8_executive_roles}
            delay={0.3}
          >
            <CheckboxGrid
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
              options={q8Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>
    </div>
  )
}
