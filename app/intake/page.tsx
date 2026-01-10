"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  User, Briefcase, Scale, Target, Wallet, Check,
  ArrowRight, ArrowLeft, Loader2, Sparkles, ExternalLink,
  TrendingUp, AlertCircle, FileText, Upload, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  createIntakeDraft,
  updateIntakeBackground,
  updateIntakeMAExperience,
  updateIntakeGoals,
  completeIntake,
} from "@/lib/actions/intake"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import {
  INTAKE_STEPS,
  validateStep,
  isStepComplete,
  getInitialFormData,
  type QuestionnaireFormData,
  type FieldErrors,
} from "@/components/questionnaire"
import { StepRenderer } from "@/components/questionnaire/step-renderer"

// Step icons mapping
const STEP_ICONS = [User, Briefcase, Scale, Target, Wallet]

// Animation variants
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

export default function IntakePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [repreneurId, setRepreneurId] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isUploadingCv, setIsUploadingCv] = useState(false)
  const cvInputRef = useRef<HTMLInputElement>(null)

  // Form state using shared initial data
  const [formData, setFormData] = useState<QuestionnaireFormData>(getInitialFormData())

  const updateField = useCallback(<K extends keyof QuestionnaireFormData>(
    field: K,
    value: QuestionnaireFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
    setServerError(null)
  }, [])

  const toggleArrayField = useCallback((field: keyof QuestionnaireFormData, value: string) => {
    setFormData(prev => {
      const current = prev[field] as string[]
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [field]: updated }
    })
  }, [])

  const handlers = { updateField, toggleArrayField }

  // Get current step config
  const currentStepConfig = INTAKE_STEPS[currentStep - 1]

  // Validate current step
  const validateCurrentStep = (): boolean => {
    const stepErrors = validateStep(currentStepConfig, formData)
    setErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  // Handle next step with save
  const handleNext = async () => {
    setServerError(null)

    if (!validateCurrentStep()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (currentStep === 1) {
        // Create draft repreneur
        const result = await createIntakeDraft({
          first_name: (formData.first_name ?? "").trim(),
          last_name: (formData.last_name ?? "").trim(),
          email: (formData.email ?? "").toLowerCase().trim(),
          phone: formData.phone?.trim() || undefined,
          linkedin_url: formData.linkedin_url?.trim() || undefined,
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
              console.error("CV upload failed")
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
          q1_employment_status: formData.q1_employment_status,
          q2_years_experience: formData.q2_years_experience,
          q3_industry_sectors: formData.q3_industry_sectors,
          q5_team_size: formData.q5_team_size,
          q8_executive_roles: formData.q8_executive_roles,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("Background info saved!")
      } else if (currentStep === 3 && repreneurId) {
        const result = await updateIntakeMAExperience(repreneurId, {
          q4_has_ma_experience: formData.q4_has_ma_experience,
          q6_involved_in_ma: formData.q6_involved_in_ma,
          q7_ma_details: formData.q7_ma_details || null,
          q9_board_experience: formData.q9_board_experience,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("M&A experience saved!")
      } else if (currentStep === 4 && repreneurId) {
        const result = await updateIntakeGoals(repreneurId, {
          q10_journey_stages: formData.q10_journey_stages,
          q11_target_sectors: formData.q11_target_sectors,
          target_location: formData.target_location ?? null,
          target_acquisition_size: formData.target_acquisition_size ?? null,
          q12_has_identified_targets: formData.q12_has_identified_targets,
          q13_target_details: formData.q13_target_details || null,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("Acquisition goals saved!")
      } else if (currentStep === 5 && repreneurId) {
        const result = await completeIntake(repreneurId, {
          q14_investment_capacity: formData.q14_investment_capacity,
          q15_funding_status: formData.q15_funding_status,
          q16_network_training: formData.q16_network_training,
          q17_open_to_co_acquisition: formData.q17_open_to_co_acquisition,
          marketing_consent: formData.marketing_consent ?? false,
          source: formData.source ?? null,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }

        setFinalScore(result.data.score)
        setIsComplete(true)
        toast.success("Registration complete!")
        return
      }

      setCurrentStep(prev => prev + 1)
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
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-lg w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-200"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Sparkles className="w-12 h-12 text-white" />
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            Welcome to Re-New!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-gray-600 mb-8"
          >
            Your profile has been created successfully. Our team will review your information and reach out to you soon.
          </motion.p>

          {finalScore !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100"
            >
              <p className="text-sm text-blue-600 font-medium mb-2">Your Readiness Score</p>
              <p className="text-5xl font-bold text-blue-700">{finalScore}</p>
              <p className="text-sm text-blue-500 mt-2">out of 100</p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              size="lg"
              className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
              onClick={() => window.open("https://renew.team", "_blank")}
            >
              Visit Re-New
              <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with progress */}
      <div className="bg-white border-b shadow-sm shrink-0">
        {/* Brand row */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Re-New</h1>
                <p className="text-xs text-gray-500">Repreneur Intake</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Step {currentStep} of {INTAKE_STEPS.length}
            </div>
          </div>
        </div>

        {/* Step indicators */}
        <div className="px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              {INTAKE_STEPS.map((step, index) => {
                const Icon = STEP_ICONS[index]
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <motion.div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl transition-all flex-1",
                        isActive && "bg-blue-50 border-2 border-blue-200",
                        isCompleted && "bg-emerald-50 border-2 border-emerald-200",
                        !isActive && !isCompleted && "bg-gray-50 border-2 border-transparent"
                      )}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          isActive && "bg-blue-600 text-white shadow-lg shadow-blue-200",
                          isCompleted && "bg-emerald-500 text-white shadow-lg shadow-emerald-200",
                          !isActive && !isCompleted && "bg-gray-200 text-gray-500"
                        )}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className={cn(
                        "text-sm font-medium hidden sm:block",
                        isActive && "text-blue-700",
                        isCompleted && "text-emerald-700",
                        !isActive && !isCompleted && "text-gray-500"
                      )}>
                        {step.title}
                      </span>
                    </motion.div>
                    {index < INTAKE_STEPS.length - 1 && (
                      <div className={cn(
                        "w-4 h-0.5 mx-1",
                        isCompleted ? "bg-emerald-300" : "bg-gray-200"
                      )} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-8 w-full">
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

            {/* Step content using shared renderer */}
            <StepRenderer
              step={currentStepConfig}
              formData={formData}
              handlers={handlers}
              errors={errors}
              variant="styled"
            />

            {/* CV Upload section for Step 1 */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Upload your CV</h3>
                    <p className="text-sm text-gray-500">Optional, PDF only (max 10MB)</p>
                  </div>
                </div>

                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                        toast.error("Please upload a PDF file")
                        return
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error("File size must be less than 10MB")
                        return
                      }
                      setCvFile(file)
                    }
                  }}
                />

                {cvFile ? (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{cvFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCvFile(null)
                        if (cvInputRef.current) cvInputRef.current.value = ""
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                    onClick={() => cvInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pb-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 1 || isSubmitting}
            className="h-12 px-6"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </Button>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={isSubmitting || isUploadingCv}
            className="h-12 px-8 min-w-[160px] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
          >
            {isSubmitting || isUploadingCv ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {isUploadingCv ? "Uploading CV..." : "Saving..."}
              </>
            ) : currentStep === INTAKE_STEPS.length ? (
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

        {/* Validation hint */}
        {!isStepComplete(currentStepConfig, formData) && Object.keys(errors).length === 0 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm text-amber-600 pb-4"
          >
            Please complete all required fields to continue
          </motion.p>
        )}
      </div>
    </div>
  )
}
