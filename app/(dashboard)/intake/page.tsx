"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  User, Briefcase, TrendingUp, Target, Wallet, Check,
  ArrowRight, ArrowLeft, Loader2, Sparkles, ExternalLink,
  Mail, Phone, Linkedin, Building2, Users, Award, Scale,
  MapPin, Euro, Handshake, GraduationCap, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  createIntakeDraft,
  updateIntakeBackground,
  updateIntakeMAExperience,
  updateIntakeGoals,
  completeIntake,
} from "@/lib/actions/intake"
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

// Step configuration
const STEPS = [
  { id: 1, title: "Welcome", icon: User, description: "Let's start with your contact information" },
  { id: 2, title: "Background", icon: Briefcase, description: "Tell us about your professional experience" },
  { id: 3, title: "M&A Experience", icon: Scale, description: "Your mergers & acquisitions background" },
  { id: 4, title: "Goals", icon: Target, description: "What are you looking for?" },
  { id: 5, title: "Financial", icon: Wallet, description: "Investment capacity & final details" },
]

// Validation helpers
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isValidPhone = (phone: string): boolean => {
  if (!phone) return true // Optional field
  // Allow various phone formats: +33 6 12 34 56 78, 0612345678, +1-555-123-4567
  const phoneRegex = /^[\d\s\-+().]{7,20}$/
  return phoneRegex.test(phone)
}

const isValidLinkedIn = (url: string): boolean => {
  if (!url) return true // Optional field
  // Allow linkedin.com/in/... or just the profile part
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w\-]+\/?$|^[\w\-]+$/
  return linkedinRegex.test(url)
}

// Animation variants
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

// Field error type
type FieldErrors = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  linkedin_url?: string
}

// Input field with error display - MUST be outside component to prevent focus loss
function InputField({
  id,
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  required = false,
}: {
  id: string
  label: string
  icon: React.ElementType
  type?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-12 text-base transition-colors",
          error && "border-red-500 focus-visible:ring-red-500"
        )}
      />
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 flex items-center gap-1"
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.p>
      )}
    </div>
  )
}

// Yes/No button component - MUST be outside component to prevent focus loss
function YesNoButtons({
  value,
  onChange
}: {
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant={value === true ? "default" : "outline"}
        className={cn(
          "flex-1 h-12 text-base transition-all",
          value === true && "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
        )}
        onClick={() => onChange(true)}
      >
        <Check className="h-5 w-5 mr-2" />
        Yes
      </Button>
      <Button
        type="button"
        variant={value === false ? "default" : "outline"}
        className={cn(
          "flex-1 h-12 text-base transition-all",
          value === false && "bg-slate-600 hover:bg-slate-700"
        )}
        onClick={() => onChange(false)}
      >
        No
      </Button>
    </div>
  )
}

export default function IntakePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [repreneurId, setRepreneurId] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Contact
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    // Step 2: Background
    q1_employment_status: null as string | null,
    q2_years_experience: null as string | null,
    q3_industry_sectors: [] as string[],
    q5_team_size: null as string | null,
    q8_executive_roles: [] as string[],
    // Step 3: M&A
    q4_has_ma_experience: null as boolean | null,
    q6_involved_in_ma: null as boolean | null,
    q7_ma_details: "",
    q9_board_experience: null as boolean | null,
    // Step 4: Goals
    q10_journey_stages: [] as string[],
    q11_target_sectors: [] as string[],
    target_location: null as string | null,
    target_acquisition_size: null as string | null,
    q12_has_identified_targets: null as boolean | null,
    q13_target_details: "",
    // Step 5: Financial
    q14_investment_capacity: null as string | null,
    q15_funding_status: null as string | null,
    q16_network_training: [] as string[],
    q17_open_to_co_acquisition: null as boolean | null,
    marketing_consent: false,
    source: null as string | null,
  })

  const updateField = useCallback(<K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when field is updated - use functional update to avoid stale closure
    setErrors(prev => ({ ...prev, [field]: undefined }))
    setServerError(null)
  }, [])

  const toggleArrayField = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => {
      const current = prev[field] as string[]
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [field]: updated }
    })
  }, [])

  // Validate Step 1 fields
  const validateStep1 = (): boolean => {
    const newErrors: FieldErrors = {}

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required"
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number"
    }

    if (formData.linkedin_url && !isValidLinkedIn(formData.linkedin_url)) {
      newErrors.linkedin_url = "Please enter a valid LinkedIn URL"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Step validation
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.first_name.trim() &&
          formData.last_name.trim() &&
          formData.email.trim() &&
          isValidEmail(formData.email) &&
          (formData.phone === "" || isValidPhone(formData.phone)) &&
          (formData.linkedin_url === "" || isValidLinkedIn(formData.linkedin_url))
        )
      case 2:
        return !!(
          formData.q1_employment_status &&
          formData.q2_years_experience &&
          formData.q3_industry_sectors.length > 0 &&
          formData.q5_team_size &&
          formData.q8_executive_roles.length > 0
        )
      case 3:
        return !!(
          formData.q4_has_ma_experience !== null &&
          formData.q6_involved_in_ma !== null &&
          formData.q9_board_experience !== null
        )
      case 4:
        return !!(
          formData.q10_journey_stages.length > 0 &&
          formData.q11_target_sectors.length > 0
        )
      case 5:
        return !!(
          formData.q14_investment_capacity &&
          formData.q15_funding_status &&
          formData.q17_open_to_co_acquisition !== null &&
          formData.marketing_consent
        )
      default:
        return false
    }
  }

  // Handle next step with save
  const handleNext = async () => {
    setServerError(null)

    // Validate step 1 with detailed errors
    if (currentStep === 1 && !validateStep1()) {
      return
    }

    if (!isStepValid(currentStep)) return
    setIsSubmitting(true)

    try {
      if (currentStep === 1) {
        // Create draft repreneur
        const result = await createIntakeDraft({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.toLowerCase().trim(),
          phone: formData.phone?.trim() || undefined,
          linkedin_url: formData.linkedin_url?.trim() || undefined,
        })

        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }

        setRepreneurId(result.data.id)
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
          target_location: formData.target_location,
          target_acquisition_size: formData.target_acquisition_size,
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
          marketing_consent: formData.marketing_consent,
          source: formData.source,
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
          {/* Success animation */}
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
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header with progress */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Brand */}
          <div className="flex items-center justify-between mb-4">
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
              Step {currentStep} of {STEPS.length}
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon
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
                  {index < STEPS.length - 1 && (
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

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
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
                {STEPS[currentStep - 1].title}
              </motion.h2>
              <motion.p
                className="text-gray-600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {STEPS[currentStep - 1].description}
              </motion.p>
            </div>

            {/* Step 1: Contact Information */}
            {currentStep === 1 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-8"
              >
                <div className="grid gap-6">
                  <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      id="first_name"
                      label="First Name"
                      icon={User}
                      placeholder="John"
                      value={formData.first_name}
                      onChange={v => updateField("first_name", v)}
                      error={errors.first_name}
                      required
                    />
                    <InputField
                      id="last_name"
                      label="Last Name"
                      icon={User}
                      placeholder="Doe"
                      value={formData.last_name}
                      onChange={v => updateField("last_name", v)}
                      error={errors.last_name}
                      required
                    />
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <InputField
                      id="email"
                      label="Email Address"
                      icon={Mail}
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={v => updateField("email", v)}
                      error={errors.email}
                      required
                    />
                  </motion.div>

                  <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      id="phone"
                      label="Phone"
                      icon={Phone}
                      type="tel"
                      placeholder="+33 6 12 34 56 78"
                      value={formData.phone}
                      onChange={v => updateField("phone", v)}
                      error={errors.phone}
                    />
                    <InputField
                      id="linkedin"
                      label="LinkedIn"
                      icon={Linkedin}
                      type="url"
                      placeholder="linkedin.com/in/johndoe"
                      value={formData.linkedin_url}
                      onChange={v => updateField("linkedin_url", v)}
                      error={errors.linkedin_url}
                    />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Professional Background */}
            {currentStep === 2 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Employment Status */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    Current Employment Status <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.q1_employment_status || ""}
                    onValueChange={v => updateField("q1_employment_status", v)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {EMPLOYMENT_STATUS_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q1_employment_status === opt.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => updateField("q1_employment_status", opt.value)}
                      >
                        <RadioGroupItem value={opt.value} id={`emp-${opt.value}`} />
                        <Label htmlFor={`emp-${opt.value}`} className="cursor-pointer flex-1">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </motion.div>

                {/* Years Experience */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-blue-600" />
                    Years of Professional Experience <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.q2_years_experience || ""}
                    onValueChange={v => updateField("q2_years_experience", v)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {YEARS_EXPERIENCE_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q2_years_experience === opt.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => updateField("q2_years_experience", opt.value)}
                      >
                        <RadioGroupItem value={opt.value} id={`exp-${opt.value}`} />
                        <Label htmlFor={`exp-${opt.value}`} className="cursor-pointer flex-1">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </motion.div>

                {/* Industry Sectors */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Industry Experience (select all that apply) <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                    {INDUSTRY_SECTOR_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q3_industry_sectors.includes(opt.value)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => toggleArrayField("q3_industry_sectors", opt.value)}
                      >
                        <Checkbox
                          checked={formData.q3_industry_sectors.includes(opt.value)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Team Size */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-blue-600" />
                    Largest Team Size Managed <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.q5_team_size || ""}
                    onValueChange={v => updateField("q5_team_size", v)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {TEAM_SIZE_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q5_team_size === opt.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => updateField("q5_team_size", opt.value)}
                      >
                        <RadioGroupItem value={opt.value} id={`team-${opt.value}`} />
                        <Label htmlFor={`team-${opt.value}`} className="cursor-pointer flex-1">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </motion.div>

                {/* Executive Roles */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-blue-600" />
                    Executive Roles Held (select all that apply) <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {EXECUTIVE_ROLE_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q8_executive_roles.includes(opt.value)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => toggleArrayField("q8_executive_roles", opt.value)}
                      >
                        <Checkbox
                          checked={formData.q8_executive_roles.includes(opt.value)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Step 3: M&A Experience */}
            {currentStep === 3 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Scale className="w-5 h-5 text-blue-600" />
                    Do you have M&A experience? <span className="text-red-500">*</span>
                  </Label>
                  <YesNoButtons
                    value={formData.q4_has_ma_experience}
                    onChange={v => updateField("q4_has_ma_experience", v)}
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold mb-4 block">
                    Have you been directly involved in M&A transactions? <span className="text-red-500">*</span>
                  </Label>
                  <YesNoButtons
                    value={formData.q6_involved_in_ma}
                    onChange={v => updateField("q6_involved_in_ma", v)}
                  />
                </motion.div>

                {(formData.q4_has_ma_experience || formData.q6_involved_in_ma) && (
                  <motion.div
                    variants={itemVariants}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6"
                  >
                    <Label className="text-base font-semibold mb-4 block">
                      Please describe your M&A experience (optional)
                    </Label>
                    <Textarea
                      value={formData.q7_ma_details}
                      onChange={e => updateField("q7_ma_details", e.target.value)}
                      placeholder="Describe your involvement in acquisitions, sales, or other M&A transactions..."
                      rows={4}
                      className="resize-none"
                    />
                  </motion.div>
                )}

                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold mb-4 block">
                    Do you have board or advisory experience? <span className="text-red-500">*</span>
                  </Label>
                  <YesNoButtons
                    value={formData.q9_board_experience}
                    onChange={v => updateField("q9_board_experience", v)}
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Step 4: Acquisition Goals */}
            {currentStep === 4 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Journey Stage */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-blue-600" />
                    Where are you in your acquisition journey? (select all that apply) <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {JOURNEY_STAGE_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q10_journey_stages.includes(opt.value)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => toggleArrayField("q10_journey_stages", opt.value)}
                      >
                        <Checkbox
                          checked={formData.q10_journey_stages.includes(opt.value)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Target Sectors */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Target Acquisition Sectors (select all that apply) <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                    {INDUSTRY_SECTOR_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q11_target_sectors.includes(opt.value)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => toggleArrayField("q11_target_sectors", opt.value)}
                      >
                        <Checkbox
                          checked={formData.q11_target_sectors.includes(opt.value)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Target Location & Size */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        Target Location
                      </Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {TARGET_LOCATION_OPTIONS.map(opt => (
                          <div
                            key={opt.value}
                            className={cn(
                              "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                              formData.target_location === opt.value
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                            )}
                            onClick={() => updateField("target_location", opt.value)}
                          >
                            <RadioGroupItem
                              value={opt.value}
                              checked={formData.target_location === opt.value}
                              className="pointer-events-none"
                            />
                            <span className="text-sm">{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                        <Euro className="w-5 h-5 text-blue-600" />
                        Target Acquisition Size
                      </Label>
                      <div className="space-y-2">
                        {TARGET_ACQUISITION_SIZE_OPTIONS.map(opt => (
                          <div
                            key={opt.value}
                            className={cn(
                              "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                              formData.target_acquisition_size === opt.value
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                            )}
                            onClick={() => updateField("target_acquisition_size", opt.value)}
                          >
                            <RadioGroupItem
                              value={opt.value}
                              checked={formData.target_acquisition_size === opt.value}
                              className="pointer-events-none"
                            />
                            <span className="text-sm">{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Identified Targets */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold mb-4 block">
                    Have you identified specific acquisition targets?
                  </Label>
                  <YesNoButtons
                    value={formData.q12_has_identified_targets}
                    onChange={v => updateField("q12_has_identified_targets", v)}
                  />
                </motion.div>

                {formData.q12_has_identified_targets && (
                  <motion.div
                    variants={itemVariants}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6"
                  >
                    <Label className="text-base font-semibold mb-4 block">
                      Describe your identified targets (optional)
                    </Label>
                    <Textarea
                      value={formData.q13_target_details}
                      onChange={e => updateField("q13_target_details", e.target.value)}
                      placeholder="Revenue range, number of employees, sector, valuation..."
                      rows={4}
                      className="resize-none"
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 5: Financial & Consent */}
            {currentStep === 5 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Investment Capacity */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Wallet className="w-5 h-5 text-blue-600" />
                    Investment Capacity <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.q14_investment_capacity || ""}
                    onValueChange={v => updateField("q14_investment_capacity", v)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {INVESTMENT_CAPACITY_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q14_investment_capacity === opt.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => updateField("q14_investment_capacity", opt.value)}
                      >
                        <RadioGroupItem value={opt.value} id={`inv-${opt.value}`} />
                        <Label htmlFor={`inv-${opt.value}`} className="cursor-pointer flex-1">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </motion.div>

                {/* Funding Status */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Euro className="w-5 h-5 text-blue-600" />
                    Funding Status <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.q15_funding_status || ""}
                    onValueChange={v => updateField("q15_funding_status", v)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {FUNDING_STATUS_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q15_funding_status === opt.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => updateField("q15_funding_status", opt.value)}
                      >
                        <RadioGroupItem value={opt.value} id={`fund-${opt.value}`} />
                        <Label htmlFor={`fund-${opt.value}`} className="cursor-pointer flex-1">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </motion.div>

                {/* Network & Training */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                    Network or Training Affiliations (select all that apply)
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {NETWORK_TRAINING_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          formData.q16_network_training.includes(opt.value)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => toggleArrayField("q16_network_training", opt.value)}
                      >
                        <Checkbox
                          checked={formData.q16_network_training.includes(opt.value)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Co-acquisition */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Handshake className="w-5 h-5 text-blue-600" />
                    Open to co-acquisition? <span className="text-red-500">*</span>
                  </Label>
                  <YesNoButtons
                    value={formData.q17_open_to_co_acquisition}
                    onChange={v => updateField("q17_open_to_co_acquisition", v)}
                  />
                </motion.div>

                {/* How did you hear about us */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
                  <Label className="text-base font-semibold mb-4 block">
                    How did you hear about Re-New? (optional)
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {SOURCE_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          formData.source === opt.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => updateField("source", opt.value)}
                      >
                        <RadioGroupItem
                          value={opt.value}
                          checked={formData.source === opt.value}
                          className="pointer-events-none"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* GDPR Consent */}
                <motion.div variants={itemVariants} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6">
                  <div
                    className={cn(
                      "flex items-start space-x-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                      formData.marketing_consent
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    )}
                    onClick={() => updateField("marketing_consent", !formData.marketing_consent)}
                  >
                    <Checkbox
                      checked={formData.marketing_consent}
                      className="mt-1 pointer-events-none"
                    />
                    <div>
                      <Label className="font-semibold cursor-pointer">
                        I agree to receive communications from Re-New <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        By checking this box, you consent to Re-New processing your personal data and contacting you about our services. You can unsubscribe at any time.
                      </p>
                    </div>
                  </div>
                </motion.div>
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
            disabled={isSubmitting}
            className={cn(
              "h-12 px-8 min-w-[160px] transition-all",
              currentStep === STEPS.length
                ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-200"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : currentStep === STEPS.length ? (
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
        {!isStepValid(currentStep) && Object.keys(errors).length === 0 && (
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
