'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { INTAKE_STEPS } from '@/lib/config/questionnaire-v2'
import { TEST_ALL_DATA, SHOW_AUTOFILL } from '@/lib/config/intake-test-data'
import {
  StepContact,
  StepWho,
  StepProjectStatus,
  StepWhen,
  StepNeeds,
  StepReview
} from './steps'
import type { IntakeV2FormData, IntakeV2FormState, INITIAL_FORM_STATE } from '@/lib/types/intake-v2'
import { submitIntakeV2 } from '@/lib/actions/intake-v2'
import { Zap } from 'lucide-react'

/**
 * Multi-step intake form orchestrator
 * Manages state, navigation, validation, and submission
 */
export function IntakeFormV2() {
  const router = useRouter()

  const [state, setState] = useState<IntakeV2FormState>({
    currentStep: 1,
    data: {},
    errors: {},
    isSubmitting: false,
    submitResult: null
  })

  const { currentStep, data, errors, isSubmitting } = state

  // Update form data
  const handleChange = useCallback((updates: Partial<IntakeV2FormData>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
      errors: {} // Clear errors when user makes changes
    }))
  }, [])

  // Navigate to next step
  const handleNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, INTAKE_STEPS.length)
    }))
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Navigate to previous step
  const handleBack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1)
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Navigate to specific step (for editing from review)
  const handleEditStep = useCallback((stepNumber: number) => {
    setState(prev => ({
      ...prev,
      currentStep: stepNumber
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Submit the form
  const handleSubmit = useCallback(async () => {
    setState(prev => ({ ...prev, isSubmitting: true }))

    try {
      const result = await submitIntakeV2(data as IntakeV2FormData)

      if (result.success) {
        router.push('/intake-v2/success')
      } else {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          submitResult: result
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitResult: {
          success: false,
          error: 'Une erreur est survenue. Veuillez réessayer.'
        }
      }))
    }
  }, [data, router])

  // Calculate progress percentage
  const progressPercent = (currentStep / INTAKE_STEPS.length) * 100

  // Render current step
  const renderStep = () => {
    const commonProps = {
      data,
      onChange: handleChange,
      onNext: handleNext,
      onBack: handleBack,
      errors,
      isSubmitting
    }

    switch (currentStep) {
      case 1:
        return <StepContact {...commonProps} onBack={undefined} />
      case 2:
        return <StepWho {...commonProps} />
      case 3:
        return <StepProjectStatus {...commonProps} />
      case 4:
        return <StepWhen {...commonProps} />
      case 5:
        return <StepNeeds {...commonProps} />
      case 6:
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

  // Fill all fields for quick testing
  const handleFillAll = () => {
    setState(prev => ({
      ...prev,
      data: {
        ...TEST_ALL_DATA,
        email: `test-${Date.now()}@example.com`,
        cv_url: 'https://example.com/test-cv.pdf',
      },
      currentStep: 6 // Jump to review
    }))
  }

  const currentStepInfo = INTAKE_STEPS[currentStep - 1]

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Quick Fill All button for testing */}
      {SHOW_AUTOFILL && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-yellow-800">
            Mode test activé
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleFillAll}
            className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
          >
            <Zap className="h-4 w-4 mr-1" />
            Remplir tout & aller à la review
          </Button>
        </div>
      )}

      {/* Header with progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Étape {currentStep} sur {INTAKE_STEPS.length}
          </span>
          <span className="text-sm font-medium">
            {currentStepInfo.title}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />

        {/* Step indicators */}
        <div className="flex justify-between mt-4">
          {INTAKE_STEPS.map((step, index) => {
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : stepNum}
                </div>
                <span className="text-xs mt-1 text-muted-foreground hidden sm:block">
                  {step.title}
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
          Des questions ? Contactez-nous à{' '}
          <a href="mailto:contact@re-new.team" className="text-primary hover:underline">
            contact@re-new.team
          </a>
        </p>
      </div>
    </div>
  )
}
