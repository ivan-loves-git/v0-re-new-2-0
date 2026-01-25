"use client"

import { useState, useCallback, useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { motion, AnimatePresence } from "framer-motion"
import {
  User, Briefcase, Scale, Target, Wallet,
  ArrowRight, ArrowLeft, Loader2, Sparkles,
  AlertCircle, Cloud, CloudOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  createIntakeDraft,
  updateIntakeBackground,
  updateIntakeMAExperience,
  updateIntakeGoals,
  completeIntake,
} from "@/lib/actions/intake"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import type { StepConfig } from "@/components/questionnaire/types"
import { GlassProgress } from "./components/glass-progress"
import { CompletionScreen } from "./components/completion-screen"
import { StepContact } from "./steps/step-contact"
import { StepBackground } from "./steps/step-background"
import { StepMAExperience } from "./steps/step-ma-experience"
import { StepGoals } from "./steps/step-goals"
import { StepFinancial } from "./steps/step-financial"
import { useFormPersistence } from "./hooks/use-form-persistence"
import { useAutoSave } from "./hooks/use-auto-save"
import {
  getInitialFormValues,
  validateStep as validateStepSchema,
  type IntakeFormData,
} from "./form-config"

// Step icons mapping
const STEP_ICONS = [
  <User key="user" className="w-5 h-5" />,
  <Briefcase key="briefcase" className="w-5 h-5" />,
  <Scale key="scale" className="w-5 h-5" />,
  <Target key="target" className="w-5 h-5" />,
  <Wallet key="wallet" className="w-5 h-5" />,
]

// Animation variants
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

interface IntakeFormV2Props {
  steps: StepConfig[]
}

export function IntakeFormV2({ steps }: IntakeFormV2Props) {
  // State
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [repreneurId, setRepreneurId] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // File uploads
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isUploadingCv, setIsUploadingCv] = useState(false)
  const [ldcFile, setLdcFile] = useState<File | null>(null)
  const [isUploadingLdc, setIsUploadingLdc] = useState(false)

  // Persistence
  const { loadSavedState, saveState, clearSavedState } = useFormPersistence()

  // TanStack Form
  const form = useForm({
    defaultValues: getInitialFormValues(),
    onSubmit: async () => {
      // Submit handled by handleNext
    },
  })

  // Auto-save hook
  const { saveStatus, debouncedSave } = useAutoSave({
    onSave: (data, step, id) => saveState(data, step, id),
  })

  // Load saved state on mount
  useEffect(() => {
    const saved = loadSavedState()
    if (saved) {
      // Restore form data
      Object.entries(saved.formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          form.setFieldValue(key as keyof IntakeFormData, value as any)
        }
      })
      // Restore step and repreneur ID
      if (saved.step) setCurrentStep(saved.step)
      if (saved.repreneurId) setRepreneurId(saved.repreneurId)
      toast.info("Restored your previous progress")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on form changes
  useEffect(() => {
    const values = form.state.values
    debouncedSave(values, currentStep, repreneurId)
  }, [form.state.values, currentStep, repreneurId, debouncedSave])

  // Get current step config
  const currentStepConfig = steps[currentStep - 1]

  // Validate current step
  const validateCurrentStep = useCallback((): boolean => {
    const values = form.state.values
    const { success, errors } = validateStepSchema(currentStep, values)
    setFieldErrors(errors)
    return success
  }, [currentStep, form.state.values])

  // Handle next step with save
  const handleNext = async () => {
    setServerError(null)
    setFieldErrors({})

    if (!validateCurrentStep()) {
      toast.error("Please complete all required fields")
      return
    }

    setIsSubmitting(true)
    const values = form.state.values

    try {
      if (currentStep === 1) {
        // Create draft repreneur
        const result = await createIntakeDraft({
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email.toLowerCase().trim(),
          phone: values.phone?.trim() || undefined,
          linkedin_url: values.linkedin_url?.trim() || undefined,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }

        setRepreneurId(result.data.id)

        // Upload CV if one was selected
        if (cvFile) {
          setIsUploadingCv(true)
          try {
            const cvFormData = new FormData()
            cvFormData.append("file", cvFile)
            cvFormData.append("repreneurId", result.data.id)

            const cvResponse = await fetch("/api/upload-cv", {
              method: "POST",
              body: cvFormData,
            })

            if (cvResponse.ok) {
              const { url } = await cvResponse.json()
              await updateRepreneurField(result.data.id, "cv_url", url)
            } else {
              toast.error("CV upload failed, but you can add it later")
            }
          } catch (cvError) {
            console.error("CV upload error:", cvError)
            toast.error("CV upload failed, but you can add it later")
          } finally {
            setIsUploadingCv(false)
          }
        }

        if (result.data.isExisting) {
          toast.info("Welcome back! We found your existing profile.")
        } else {
          toast.success("Contact info saved!")
        }
      } else if (currentStep === 2 && repreneurId) {
        const result = await updateIntakeBackground(repreneurId, {
          q1_employment_status: values.q1_employment_status,
          q2_years_experience: values.q2_years_experience,
          q3_industry_sectors: values.q3_industry_sectors,
          q5_team_size: values.q5_team_size,
          q8_executive_roles: values.q8_executive_roles,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("Background info saved!")
      } else if (currentStep === 3 && repreneurId) {
        const result = await updateIntakeMAExperience(repreneurId, {
          q4_has_ma_experience: values.q4_has_ma_experience,
          q6_involved_in_ma: values.q6_involved_in_ma,
          q7_ma_details: values.q7_ma_details || null,
          q9_board_experience: values.q9_board_experience,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("M&A experience saved!")
      } else if (currentStep === 4 && repreneurId) {
        const result = await updateIntakeGoals(repreneurId, {
          q10_journey_stages: values.q10_journey_stages,
          q11_target_sectors: values.q11_target_sectors,
          target_location: values.target_location ?? null,
          target_acquisition_size: values.target_acquisition_size ?? null,
          q12_has_identified_targets: values.q12_has_identified_targets ?? null,
          q13_target_details: values.q13_target_details || null,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }

        // Upload LDC if one was selected
        if (ldcFile) {
          setIsUploadingLdc(true)
          try {
            const ldcFormData = new FormData()
            ldcFormData.append("file", ldcFile)
            ldcFormData.append("repreneurId", repreneurId)
            ldcFormData.append("documentType", "ldc")

            const ldcResponse = await fetch("/api/upload-cv", {
              method: "POST",
              body: ldcFormData,
            })

            if (ldcResponse.ok) {
              const { url } = await ldcResponse.json()
              await updateRepreneurField(repreneurId, "ldc_url", url)
            } else {
              toast.error("Document upload failed, but you can add it later")
            }
          } catch (ldcError) {
            console.error("LDC upload error:", ldcError)
            toast.error("Document upload failed, but you can add it later")
          } finally {
            setIsUploadingLdc(false)
          }
        }

        toast.success("Acquisition goals saved!")
      } else if (currentStep === 5 && repreneurId) {
        const result = await completeIntake(repreneurId, {
          q14_investment_capacity: values.q14_investment_capacity,
          q15_funding_status: values.q15_funding_status,
          q16_network_training: values.q16_network_training ?? [],
          q17_open_to_co_acquisition: values.q17_open_to_co_acquisition,
          marketing_consent: values.marketing_consent ?? false,
          source: values.source ?? null,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }

        // Clear saved state on completion
        clearSavedState()

        setFinalScore(result.data.score)
        setIsComplete(true)
        toast.success("Registration complete!")
        return
      }

      setCurrentStep((prev) => prev + 1)
    } catch (error) {
      console.error("Error saving step:", error)
      const message = "An unexpected error occurred. Please try again."
      setServerError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Completion screen
  if (isComplete) {
    return <CompletionScreen finalScore={finalScore} />
  }

  // Build step info for progress bar
  const stepInfo = steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    icon: STEP_ICONS[index],
  }))

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header with progress */}
      <div className="bg-white/80 backdrop-blur-sm border-b shadow-sm shrink-0 sticky top-0 z-50">
        {/* Brand row */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://cdn.prod.website-files.com/68a87ebceebd6aec9fa8d6b3/68b6fe358d32a837b0522d9a_Logo.svg"
                alt="Re-New"
                className="h-10 w-auto"
              />
              <div>
                <p className="text-xs text-gray-500">Repreneur Intake</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-save indicator */}
              <AnimatePresence mode="wait">
                {saveStatus === "saved" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1.5 text-xs text-emerald-600"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Saved</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="text-sm text-gray-500">
                Step {currentStep} of {steps.length}
              </div>
            </div>
          </div>
        </div>

        {/* Glass progress bar */}
        <div className="px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <GlassProgress steps={stepInfo} currentStep={currentStep} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">
        {/* Server error banner */}
        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{serverError}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Step header */}
            <div className="text-center mb-8">
              <motion.h2
                className="text-2xl font-bold text-gray-900 mb-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {currentStepConfig.title}
              </motion.h2>
              <motion.p
                className="text-gray-600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {currentStepConfig.description}
              </motion.p>
            </div>

            {/* Step content */}
            {currentStep === 1 && (
              <StepContact
                form={form}
                cvFile={cvFile}
                onCvChange={setCvFile}
                isUploadingCv={isUploadingCv}
                fieldErrors={fieldErrors}
              />
            )}
            {currentStep === 2 && (
              <StepBackground
                form={form}
                stepConfig={currentStepConfig}
                fieldErrors={fieldErrors}
              />
            )}
            {currentStep === 3 && (
              <StepMAExperience form={form} fieldErrors={fieldErrors} />
            )}
            {currentStep === 4 && (
              <StepGoals
                form={form}
                stepConfig={currentStepConfig}
                ldcFile={ldcFile}
                onLdcChange={setLdcFile}
                isUploadingLdc={isUploadingLdc}
                fieldErrors={fieldErrors}
              />
            )}
            {currentStep === 5 && (
              <StepFinancial
                form={form}
                stepConfig={currentStepConfig}
                fieldErrors={fieldErrors}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-10 pb-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            disabled={currentStep === 1 || isSubmitting}
            className="h-12 px-6"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </Button>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={isSubmitting || isUploadingCv || isUploadingLdc}
            className="h-12 px-8 min-w-[160px] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
          >
            {isSubmitting || isUploadingCv || isUploadingLdc ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {isUploadingCv ? "Uploading CV..." : isUploadingLdc ? "Uploading..." : "Saving..."}
              </>
            ) : currentStep === steps.length ? (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Complete
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Field errors summary */}
        {Object.keys(fieldErrors).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center pb-4"
          >
            <p className="text-sm text-amber-600">
              Please complete all required fields to continue
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
