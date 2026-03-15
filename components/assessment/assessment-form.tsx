'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { useLanguage } from '@/lib/i18n/language-context'
import { ASSESSMENT_STEPS } from '@/lib/config/leadership-assessment'
import { submitAssessment } from '@/lib/actions/leadership-assessment'
import { StepBlocA, StepBlocB, StepBlocC, StepReview } from './steps'
import type { LeadershipFormData, LeadershipFormState } from '@/lib/types/leadership-assessment'

interface AssessmentFormProps {
  token: string
  repreneurName?: string
}

const TOTAL_STEPS = ASSESSMENT_STEPS.length

export function AssessmentForm({ token, repreneurName }: AssessmentFormProps) {
  const router = useRouter()
  const { language } = useLanguage()

  const [state, setState] = useState<LeadershipFormState>({
    currentStep: 1,
    data: {},
    errors: {},
    isSubmitting: false,
    submitResult: null,
  })

  const { currentStep, data, errors, isSubmitting } = state

  // Update form data
  const handleChange = useCallback((updates: Partial<LeadershipFormData>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
      errors: {},
    }))
  }, [])

  // Navigate to next step
  const handleNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS),
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Navigate to previous step
  const handleBack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Navigate to specific step (for editing from review)
  const handleEditStep = useCallback((stepNumber: number) => {
    setState(prev => ({
      ...prev,
      currentStep: stepNumber,
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Submit the form
  const handleSubmit = useCallback(async () => {
    setState(prev => ({ ...prev, isSubmitting: true }))

    try {
      const result = await submitAssessment(token, data as LeadershipFormData)

      if (result.success) {
        router.push(`/assessment/${token}/success`)
      } else {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          submitResult: result,
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitResult: {
          success: false,
          error: language === 'fr'
            ? 'Une erreur est survenue. Veuillez reessayer.'
            : 'An error occurred. Please try again.',
        },
      }))
    }
  }, [data, router, token, language])

  // Calculate progress percentage
  const progressPercent = (currentStep / TOTAL_STEPS) * 100

  // Render current step
  const renderStep = () => {
    const commonProps = {
      data,
      onChange: handleChange,
      onNext: handleNext,
      onBack: handleBack,
      errors,
      isSubmitting,
    }

    switch (currentStep) {
      case 1:
        return <StepBlocA {...commonProps} onBack={undefined} />
      case 2:
        return <StepBlocB {...commonProps} />
      case 3:
        return <StepBlocC {...commonProps} />
      case 4:
        return (
          <StepReview
            {...commonProps}
            onEditStep={handleEditStep}
            onSubmit={handleSubmit}
          />
        )
      default:
        return null
    }
  }

  const stepLabel = language === 'fr' ? 'Etape' : 'Step'
  const ofLabel = language === 'fr' ? 'sur' : 'of'
  const contactLabel = language === 'fr' ? 'Des questions ? Contactez-nous a' : 'Questions? Contact us at'

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header with progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {stepLabel} {currentStep} {ofLabel} {TOTAL_STEPS}
          </span>
          <span className="text-sm font-medium">
            {language === 'fr'
              ? ASSESSMENT_STEPS[currentStep - 1].title
              : ASSESSMENT_STEPS[currentStep - 1].titleEn}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />

        {/* Step indicators */}
        <div className="flex justify-between mt-4">
          {ASSESSMENT_STEPS.map((step, index) => {
            const stepNum = index + 1
            const isCompleted = stepNum < currentStep
            const isCurrent = stepNum === currentStep

            return (
              <div
                key={step.id}
                className={`flex flex-col items-center ${
                  index > 0 ? 'flex-1' : ''
                }`}
              >
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '\u2713' : stepNum}
                </div>
                <span className="text-xs mt-1 text-muted-foreground hidden sm:block">
                  {language === 'fr' ? step.title : step.titleEn}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Error display */}
      {state.submitResult?.error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">
            {state.submitResult.error}
          </p>
        </div>
      )}

      {/* Current step content */}
      <div className="bg-card border rounded-lg p-6 shadow-sm">
        {renderStep()}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          {contactLabel}{' '}
          <a href="mailto:contact@re-new.team" className="text-primary hover:underline">
            contact@re-new.team
          </a>
        </p>
      </div>
    </div>
  )
}
