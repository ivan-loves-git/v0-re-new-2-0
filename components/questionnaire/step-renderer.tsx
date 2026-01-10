"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  User, Briefcase, Scale, Target, Wallet, Award,
  Building2, Users, MapPin, Euro, GraduationCap, Handshake,
  Mail, Phone, Linkedin
} from "lucide-react"
import type { StepConfig, QuestionConfig, QuestionnaireFormData, FormHandlers, FieldErrors, ShowIfCondition } from "./types"

/**
 * Evaluate a serializable showIfCondition
 * Supports simple field equality and OR conditions
 */
function evaluateShowIfCondition(condition: ShowIfCondition, formData: QuestionnaireFormData): boolean {
  const fieldValue = formData[condition.field]
  const matches = fieldValue === condition.equals

  if (condition.operator === "or" && condition.orField) {
    const orFieldValue = formData[condition.orField]
    const orMatches = orFieldValue === condition.orEquals
    return matches || orMatches
  }

  return matches
}

/**
 * Check if a question should be shown based on conditions
 */
function shouldShowQuestion(question: QuestionConfig, formData: QuestionnaireFormData): boolean {
  // Check function-based condition (for static configs)
  if (question.showIf && !question.showIf(formData)) {
    return false
  }
  // Check serializable condition (for dynamic configs)
  if (question.showIfCondition && !evaluateShowIfCondition(question.showIfCondition, formData)) {
    return false
  }
  return true
}
import {
  YesNoButtons,
  RadioOptionGrid,
  CheckboxGrid,
  TextInput,
  TextareaInput,
  ConsentCheckbox,
} from "./question-inputs"

// Icon mapping
const ICONS: Record<string, React.ElementType> = {
  User,
  Briefcase,
  Scale,
  Target,
  Wallet,
  Award,
  Building2,
  Users,
  MapPin,
  Euro,
  GraduationCap,
  Handshake,
  Mail,
  Phone,
  Linkedin,
}

// =====================
// QUESTION RENDERER
// =====================

interface QuestionRendererProps {
  question: QuestionConfig
  formData: QuestionnaireFormData
  handlers: FormHandlers
  errors?: FieldErrors
  variant?: "default" | "styled"
}

export function QuestionRenderer({
  question,
  formData,
  handlers,
  errors,
  variant = "styled",
}: QuestionRendererProps) {
  const { updateField, toggleArrayField } = handlers
  const fieldKey = question.id as keyof QuestionnaireFormData
  const value = formData[fieldKey]
  const error = errors?.[fieldKey]
  const Icon = question.icon ? ICONS[question.icon] : null

  // Check conditional display
  if (!shouldShowQuestion(question, formData)) {
    return null
  }

  // Special case for marketing consent
  if (question.id === "marketing_consent") {
    return (
      <ConsentCheckbox
        checked={formData.marketing_consent ?? false}
        onChange={(v) => updateField("marketing_consent", v)}
        label={question.label}
        description="By checking this box, you consent to Re-New processing your personal data and contacting you about our services. You can unsubscribe at any time."
        required={question.required}
        variant={variant}
      />
    )
  }

  switch (question.type) {
    case "text":
      return (
        <TextInput
          id={question.id}
          label={question.label}
          value={(value as string) ?? ""}
          onChange={(v) => updateField(fieldKey, v as QuestionnaireFormData[typeof fieldKey])}
          type={question.id === "email" ? "email" : question.id === "phone" ? "tel" : "text"}
          placeholder={question.placeholder}
          error={error}
          required={question.required}
          icon={Icon && <Icon className="w-4 h-4 text-gray-400" />}
          variant={variant}
        />
      )

    case "textarea":
      return (
        <TextareaInput
          id={question.id}
          label={question.label}
          value={value as string | null}
          onChange={(v) => updateField(fieldKey, v as QuestionnaireFormData[typeof fieldKey])}
          placeholder={question.placeholder}
          rows={question.rows}
          required={question.required}
          variant={variant}
        />
      )

    case "radio":
    case "select":
      return (
        <div className="space-y-2">
          {variant === "styled" && (
            <Label className="text-base font-semibold flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-blue-600" />}
              {question.label} {question.required && <span className="text-red-500">*</span>}
            </Label>
          )}
          {variant === "default" && (
            <Label>
              {question.label} {question.required && <span className="text-red-500">*</span>}
            </Label>
          )}
          <RadioOptionGrid
            value={value as string | null}
            onChange={(v) => updateField(fieldKey, v as QuestionnaireFormData[typeof fieldKey])}
            options={question.options ?? []}
            variant={variant}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )

    case "checkbox":
      return (
        <div className="space-y-2">
          {variant === "styled" && (
            <Label className="text-base font-semibold flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-blue-600" />}
              {question.label} {question.required && <span className="text-red-500">*</span>}
            </Label>
          )}
          {variant === "default" && (
            <Label>
              {question.label} {question.required && <span className="text-red-500">*</span>}
            </Label>
          )}
          <CheckboxGrid
            value={(value as string[]) ?? []}
            onChange={(values) => updateField(fieldKey, values as QuestionnaireFormData[typeof fieldKey])}
            options={question.options ?? []}
            variant={variant}
            maxHeight={question.options && question.options.length > 8 ? "16rem" : undefined}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )

    case "yes-no":
      return (
        <div className="space-y-2">
          {variant === "styled" && (
            <Label className="text-base font-semibold flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-blue-600" />}
              {question.label} {question.required && <span className="text-red-500">*</span>}
            </Label>
          )}
          {variant === "default" && (
            <Label>
              {question.label} {question.required && <span className="text-red-500">*</span>}
            </Label>
          )}
          <YesNoButtons
            value={value as boolean | null}
            onChange={(v) => updateField(fieldKey, v as QuestionnaireFormData[typeof fieldKey])}
            variant={variant}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )

    default:
      return null
  }
}

// =====================
// STEP RENDERER
// =====================

interface StepRendererProps {
  step: StepConfig
  formData: QuestionnaireFormData
  handlers: FormHandlers
  errors?: FieldErrors
  variant?: "default" | "styled"
  className?: string
}

/**
 * Renders all questions for a step
 * For intake: use variant="styled" with motion wrapper in parent
 * For internal: use variant="default" with simple card layout
 */
export function StepRenderer({
  step,
  formData,
  handlers,
  errors,
  variant = "styled",
  className,
}: StepRendererProps) {
  if (variant === "default") {
    // Internal questionnaire style - simple sections
    return (
      <div className={cn("space-y-4", className)}>
        {step.questions.map((question) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            formData={formData}
            handlers={handlers}
            errors={errors}
            variant="default"
          />
        ))}
      </div>
    )
  }

  // Intake style - each question in a card
  return (
    <div className={cn("space-y-6", className)}>
      {step.questions.map((question) => {
        // Skip if conditional and not shown
        if (!shouldShowQuestion(question, formData)) {
          return null
        }

        // Contact step: group first/last name and phone/linkedin
        if (step.id === 1 && question.id === "first_name") {
          const lastName = step.questions.find(q => q.id === "last_name")
          return (
            <div key="name-group" className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-8">
              <div className="grid sm:grid-cols-2 gap-4">
                <QuestionRenderer
                  question={question}
                  formData={formData}
                  handlers={handlers}
                  errors={errors}
                  variant="styled"
                />
                {lastName && (
                  <QuestionRenderer
                    question={lastName}
                    formData={formData}
                    handlers={handlers}
                    errors={errors}
                    variant="styled"
                  />
                )}
              </div>
            </div>
          )
        }

        // Skip last_name since we handle it with first_name
        if (question.id === "last_name") return null

        // Contact step: phone/linkedin row
        if (step.id === 1 && question.id === "phone") {
          const linkedin = step.questions.find(q => q.id === "linkedin_url")
          return (
            <div key="contact-group" className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-8">
              <div className="grid sm:grid-cols-2 gap-4">
                <QuestionRenderer
                  question={question}
                  formData={formData}
                  handlers={handlers}
                  errors={errors}
                  variant="styled"
                />
                {linkedin && (
                  <QuestionRenderer
                    question={linkedin}
                    formData={formData}
                    handlers={handlers}
                    errors={errors}
                    variant="styled"
                  />
                )}
              </div>
            </div>
          )
        }

        // Skip linkedin_url since we handle it with phone
        if (question.id === "linkedin_url") return null

        // Marketing consent gets special styling
        if (question.id === "marketing_consent") {
          return (
            <div key={question.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6">
              <QuestionRenderer
                question={question}
                formData={formData}
                handlers={handlers}
                errors={errors}
                variant="styled"
              />
            </div>
          )
        }

        // Standard card wrapper
        return (
          <div key={question.id} className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-6">
            <QuestionRenderer
              question={question}
              formData={formData}
              handlers={handlers}
              errors={errors}
              variant="styled"
            />
          </div>
        )
      })}
    </div>
  )
}

// =====================
// SECTION RENDERER (for internal questionnaire)
// =====================

interface SectionRendererProps {
  title: string
  questions: QuestionConfig[]
  formData: QuestionnaireFormData
  handlers: FormHandlers
}

/**
 * Renders a titled section with questions
 * Used by internal questionnaire for grouped display
 */
export function SectionRenderer({
  title,
  questions,
  formData,
  handlers,
}: SectionRendererProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg border-b pb-2">{title}</h3>
      {questions.map((question) => (
        <QuestionRenderer
          key={question.id}
          question={question}
          formData={formData}
          handlers={handlers}
          variant="default"
        />
      ))}
    </div>
  )
}
