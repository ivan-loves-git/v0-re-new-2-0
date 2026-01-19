"use client"

import { motion, AnimatePresence } from "framer-motion"
import { RadioOptionGrid, CheckboxGrid, YesNoButtons } from "@/components/questionnaire/question-inputs"
import { FloatingTextarea } from "../components/floating-input"
import { FileDropZone } from "../components/file-drop-zone"
import type { StepConfig } from "@/components/questionnaire/types"
import { AlertCircle } from "lucide-react"

interface StepGoalsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any // TanStack Form instance
  stepConfig: StepConfig
  ldcFile: File | null
  onLdcChange: (file: File | null) => void
  isUploadingLdc: boolean
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
 * Step 4: Acquisition Goals
 */
export function StepGoals({ form, stepConfig, ldcFile, onLdcChange, isUploadingLdc }: StepGoalsProps) {
  // Get options from step config
  const q10Options = stepConfig.questions.find(q => q.id === "q10_journey_stages")?.options ?? []
  const q11Options = stepConfig.questions.find(q => q.id === "q11_target_sectors")?.options ?? []
  const targetLocationOptions = stepConfig.questions.find(q => q.id === "target_location")?.options ?? []
  const targetSizeOptions = stepConfig.questions.find(q => q.id === "target_acquisition_size")?.options ?? []

  // Watch field for conditional
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasIdentifiedTargets = form.useStore((state: any) => state.values.q12_has_identified_targets)

  return (
    <div className="space-y-8">
      {/* Q10: Journey Stages */}
      <form.Field name="q10_journey_stages">
        {(field: any) => {
          const error = field.state.meta.errors?.[0]
          return (
            <QuestionWrapper
              label="Where are you in your acquisition journey? (select all that apply)"
              required
              error={typeof error === 'string' ? error : undefined}
              delay={0.1}
            >
              <CheckboxGrid
                value={field.state.value}
                onChange={(v) => field.handleChange(v)}
                options={q10Options}
                variant="styled"
                columns={2}
              />
            </QuestionWrapper>
          )
        }}
      </form.Field>

      {/* Q11: Target Sectors */}
      <form.Field name="q11_target_sectors">
        {(field: any) => {
          const error = field.state.meta.errors?.[0]
          return (
            <QuestionWrapper
              label="Target Acquisition Sectors (select all that apply)"
              required
              error={typeof error === 'string' ? error : undefined}
              delay={0.15}
            >
              <CheckboxGrid
                value={field.state.value}
                onChange={(v) => field.handleChange(v)}
                options={q11Options}
                variant="styled"
                columns={2}
                maxHeight="320px"
              />
            </QuestionWrapper>
          )
        }}
      </form.Field>

      {/* Target Location */}
      <form.Field name="target_location">
        {(field: any) => (
          <QuestionWrapper
            label="Target Location"
            delay={0.2}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={targetLocationOptions}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Target Acquisition Size */}
      <form.Field name="target_acquisition_size">
        {(field: any) => (
          <QuestionWrapper
            label="Target Acquisition Size"
            delay={0.25}
          >
            <RadioOptionGrid
              value={field.state.value || null}
              onChange={(v) => field.handleChange(v)}
              options={targetSizeOptions}
              variant="styled"
              columns={2}
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q12: Has Identified Targets */}
      <form.Field name="q12_has_identified_targets">
        {(field: any) => (
          <QuestionWrapper
            label="Have you identified specific acquisition targets?"
            delay={0.3}
          >
            <YesNoButtons
              value={field.state.value ?? null}
              onChange={(v) => field.handleChange(v)}
              variant="styled"
            />
          </QuestionWrapper>
        )}
      </form.Field>

      {/* Q13: Target Details (conditional) */}
      <AnimatePresence>
        {hasIdentifiedTargets === true && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <form.Field name="q13_target_details">
              {(field: any) => (
                <FloatingTextarea
                  label="Describe your identified targets (optional)"
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  placeholder="Revenue range, number of employees, sector, valuation..."
                  rows={4}
                />
              )}
            </form.Field>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lettre de Cadrage Upload */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <FileDropZone
          file={ldcFile}
          onFileChange={onLdcChange}
          title="Lettre de Cadrage"
          description="Optional - Upload if you have a framing document outlining your acquisition criteria"
          isUploading={isUploadingLdc}
          variant="amber"
        />
      </motion.div>
    </div>
  )
}
