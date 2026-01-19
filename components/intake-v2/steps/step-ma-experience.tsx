"use client"

import { motion, AnimatePresence } from "framer-motion"
import { YesNoButtons } from "@/components/questionnaire/question-inputs"
import { FloatingTextarea } from "../components/floating-input"
import { AlertCircle } from "lucide-react"

interface StepMAExperienceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any // TanStack Form instance
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
 * Step 3: M&A Experience
 */
export function StepMAExperience({ form, fieldErrors = {} }: StepMAExperienceProps) {
  // Watch fields to show/hide conditional question
  const hasMAExperience = form.useStore((state: any) => state.values.q4_has_ma_experience)
  const involvedInMA = form.useStore((state: any) => state.values.q6_involved_in_ma)
  const showMADetails = hasMAExperience === true || involvedInMA === true

  return (
    <div className="space-y-8">
      {/* Q4: Has M&A Experience */}
      <form.Field name="q4_has_ma_experience">
        {(field: any) => (
          <QuestionWrapper
            label="Do you have M&A experience?"
            required
            error={fieldErrors.q4_has_ma_experience}
            delay={0.1}
          >
            <YesNoButtons
              value={field.state.value ?? null}
              onChange={(v) => field.handleChange(v)}
              variant="styled"
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q6: Involved in M&A */}
      <form.Field name="q6_involved_in_ma">
        {(field: any) => (
          <QuestionWrapper
            label="Have you been directly involved in M&A transactions?"
            required
            error={fieldErrors.q6_involved_in_ma}
            delay={0.15}
          >
            <YesNoButtons
              value={field.state.value ?? null}
              onChange={(v) => field.handleChange(v)}
              variant="styled"
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q7: M&A Details (conditional) */}
      <AnimatePresence>
        {showMADetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <form.Field name="q7_ma_details">
              {(field: any) => (
                <FloatingTextarea
                  label="Please describe your M&A experience (optional)"
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  placeholder="Describe your involvement in acquisitions, sales, or other M&A transactions..."
                  rows={4}
                />
              )}
            </form.Field>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q9: Board Experience */}
      <form.Field name="q9_board_experience">
        {(field: any) => (
          <QuestionWrapper
            label="Do you have board or advisory experience?"
            required
            error={fieldErrors.q9_board_experience}
            delay={0.2}
          >
            <YesNoButtons
              value={field.state.value ?? null}
              onChange={(v) => field.handleChange(v)}
              variant="styled"
            />
          </QuestionWrapper>
        )}
      </form.Field>
    </div>
  )
}
