'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { INTAKE_STEPS } from '@/lib/config/questionnaire-v2'
import { SHOW_AUTOFILL } from '@/lib/config/intake-test-data'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  StepContact,
  StepWho,
  StepProjectStatus,
  StepWhen,
  StepNeeds,
  StepReview
} from './steps'
import type { IntakeV2FormData, IntakeV2FormState } from '@/lib/types/intake-v2'
import { submitIntakeV2 } from '@/lib/actions/intake-v2'
import { Zap } from 'lucide-react'

// Step title translation keys
const STEP_TITLES: Record<number, { fr: string; en: string }> = {
  1: { fr: 'Coordonnées', en: 'Contact' },
  2: { fr: 'Profil', en: 'Profile' },
  3: { fr: 'Projet', en: 'Project' },
  4: { fr: 'Critères', en: 'Criteria' },
  5: { fr: 'Besoins', en: 'Needs' },
  6: { fr: 'Vérification', en: 'Review' },
}

/**
 * Multi-step intake form orchestrator
 * Manages state, navigation, validation, and submission
 */
export function IntakeFormV2() {
  const router = useRouter()
  const { language, t } = useLanguage()

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
          error: language === 'fr'
            ? 'Une erreur est survenue. Veuillez réessayer.'
            : 'An error occurred. Please try again.'
        }
      }))
    }
  }, [data, router, language])

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

  // Fill current step for quick testing
  const handleFillCurrentStep = () => {
    const stepDataMap: Record<number, Partial<IntakeV2FormData>> = {
      1: {
        first_name: 'Jean',
        last_name: 'Dupont',
        email: `test-${Date.now()}@example.com`,
        phone: '+33 6 12 34 56 78',
        cv_url: 'https://example.com/test-cv.pdf',
        linkedin_url: 'https://linkedin.com/in/jeandupont',
      },
      2: {
        q05_status: 'entrepreneur',
        q06_experience: 'more_than_20',
        q07_leadership: 'general_management',
        q08_crisis: 'multiple',
        q09_investment: 'both',
        q10_impact: 'financial',
      },
      3: {
        q11_priority_choice: 'preferred',
        q11_project_status: ['framed', 'searching'],
      },
      4: {
        q12_geo_zones: ['ile-de-france', 'auvergne-rhone-alpes'],
        q13_target_sectors_v2: ['industry', 'services'],
        q14_deal_size: ['1-3M', '3-5M'],
        q15_structure: ['majority_without_fund'],
        q16_equity: '251-350',
        target_revenue_min_meur: 1.5,
        target_revenue_max_meur: 5,
        target_ebitda_margin_min_pct: 10,
        target_ebitda_margin_max_pct: 25,
        target_staff_size_min: 10,
        target_staff_size_max: 80,
      },
      5: {
        q17_current_needs: ['project_launch', 'deal_access', 'financing'],
        marketing_consent: true,
      },
    }

    const stepData = stepDataMap[currentStep]
    if (stepData) {
      setState(prev => ({
        ...prev,
        data: { ...prev.data, ...stepData }
      }))
    }
  }

  const stepLabel = language === 'fr' ? 'Étape' : 'Step'
  const ofLabel = language === 'fr' ? 'sur' : 'of'
  const contactLabel = language === 'fr' ? 'Des questions ? Contactez-nous à' : 'Questions? Contact us at'

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Quick Fill Step button for testing */}
      {SHOW_AUTOFILL && currentStep < 6 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-yellow-800">
            {t('testModeLabel')}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleFillCurrentStep}
            className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
          >
            <Zap className="size-4 mr-1" />
            {t('fillStep')}
          </Button>
        </div>
      )}

      {/* Header with progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {stepLabel} {currentStep} {ofLabel} {INTAKE_STEPS.length}
          </span>
          <span className="text-sm font-medium">
            {STEP_TITLES[currentStep][language]}
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
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
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
                  {STEP_TITLES[stepNum][language]}
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
