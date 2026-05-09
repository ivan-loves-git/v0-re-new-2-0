"use client"

import { motion } from "framer-motion"
import { RadioOptionGrid, CheckboxGrid, YesNoButtons } from "@/components/questionnaire/question-inputs"
import type { StepConfig } from "@/components/questionnaire/types"
import { AlertCircle, Info } from "lucide-react"

interface StepFinancialProps {
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
 * Step 5: Financial & Final Details
 */
export function StepFinancial({ form, stepConfig, fieldErrors = {} }: StepFinancialProps) {
  // Get options from step config
  const q14Options = stepConfig.questions.find(q => q.id === "q14_investment_capacity")?.options ?? []
  const q15Options = stepConfig.questions.find(q => q.id === "q15_funding_status")?.options ?? []
  const q16Options = stepConfig.questions.find(q => q.id === "q16_network_training")?.options ?? []
  const sourceOptions = stepConfig.questions.find(q => q.id === "source")?.options ?? []

  return (
    <div className="space-y-8">
      {/* Q14: Investment Capacity */}
      <form.Field name="q14_investment_capacity">
        {(field: any) => (
          <QuestionWrapper
            label="Investment Capacity"
            required
            error={fieldErrors.q14_investment_capacity}
            delay={0.1}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={q14Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q15: Funding Status */}
      <form.Field name="q15_funding_status">
        {(field: any) => (
          <QuestionWrapper
            label="Funding Status"
            required
            error={fieldErrors.q15_funding_status}
            delay={0.15}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={q15Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q16: Network/Training */}
      <form.Field name="q16_network_training">
        {(field: any) => (
          <QuestionWrapper
            label="Network or Training Affiliations (select all that apply)"
            delay={0.2}
          >
            <CheckboxGrid
              value={field.state.value ?? []}
              onChange={(v) => field.handleChange(v)}
              options={q16Options}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q17: Open to Co-acquisition */}
      <form.Field name="q17_open_to_co_acquisition">
        {(field: any) => (
          <QuestionWrapper
            label="Open to co-acquisition?"
            required
            error={fieldErrors.q17_open_to_co_acquisition}
            delay={0.25}
          >
            <YesNoButtons
              value={field.state.value ?? null}
              onChange={(v) => field.handleChange(v)}
              variant="styled"
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="border-t border-gray-200 pt-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Final Details</h3>
      </motion.div>

      {/* Source */}
      <form.Field name="source">
        {(field: any) => (
          <QuestionWrapper
            label="How did you hear about Re-New? (optional)"
            delay={0.35}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={sourceOptions}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Marketing Consent */}
      <form.Field name="marketing_consent">
        {(field: any) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div
              className={`flex items-start space-x-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                field.state.value === true
                  ? "border-blue-500 bg-blue-50"
                  : fieldErrors.marketing_consent
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200 bg-white hover:border-blue-300"
              }`}
              onClick={() => field.handleChange(true)}
            >
              <div
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
                  field.state.value === true
                    ? "bg-blue-600 border-blue-600"
                    : fieldErrors.marketing_consent
                      ? "border-red-400"
                      : "border-gray-300"
                }`}
              >
                {field.state.value === true && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </motion.svg>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  I agree to receive communications from Re-New
                  <span className="text-red-500 ml-1">*</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  We'll keep you updated on your application status and relevant opportunities.
                </p>
              </div>
            </div>
            {fieldErrors.marketing_consent && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-sm text-red-500 mt-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {fieldErrors.marketing_consent}
              </motion.p>
            )}
          </motion.div>
        )}
      </form.Field>

      {/* Privacy note */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100"
      >
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Your information is secure and will only be used to help match you with the right acquisition opportunities.
        </p>
      </motion.div>
    </div>
  )
}
