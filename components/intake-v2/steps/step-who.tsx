'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { WHO_QUESTIONS } from '@/lib/config/questionnaire-v2'
import { useLanguage } from '@/lib/i18n/language-context'
import type { IntakeV2StepProps } from '@/lib/types/intake-v2'

// Translation keys for WHO questions and options
const WHO_TRANSLATION_MAP: Record<string, { label: string; options: Record<string, string> }> = {
  q05: {
    label: 'q05Label',
    options: {
      entrepreneur: 'q05_entrepreneur',
      freelance: 'q05_freelance',
      employee: 'q05_employee',
      transition: 'q05_transition',
      other: 'q05_other',
    }
  },
  q06: {
    label: 'q06Label',
    options: {
      more_than_20: 'q06_more_than_20',
      '10_to_20': 'q06_10_to_20',
      less_than_10: 'q06_less_than_10',
    }
  },
  q07: {
    label: 'q07Label',
    options: {
      general_management: 'q07_general_management',
      mgmt_over_10: 'q07_mgmt_over_10',
      mgmt_under_10: 'q07_mgmt_under_10',
      none: 'q07_none',
    }
  },
  q08: {
    label: 'q08Label',
    options: {
      multiple: 'q08_multiple',
      once: 'q08_once',
      none: 'q08_none',
    }
  },
  q09: {
    label: 'q09Label',
    options: {
      both: 'q09_both',
      personal: 'q09_personal',
      professional: 'q09_professional',
      none: 'q09_none',
    }
  },
  q10: {
    label: 'q10Label',
    options: {
      financial: 'q10_financial',
      trajectory: 'q10_trajectory',
      limited: 'q10_limited',
      none: 'q10_none',
    }
  },
}

/**
 * Step 2: WHO Questions (Q05-Q10)
 * Profile quality assessment - 6 radio groups
 */
export function StepWho({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
  const { t } = useLanguage()
  const questions = Object.entries(WHO_QUESTIONS)

  const isValid = () => {
    return questions.every(([, q]) => {
      const value = data[q.field as keyof typeof data]
      return value && String(value).trim() !== ''
    })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t('step2Title')}</h2>
        <p className="text-muted-foreground">
          {t('step2Description')}
        </p>
      </div>

      {questions.map(([questionId, question], index) => {
        const translationMap = WHO_TRANSLATION_MAP[questionId]
        return (
          <div key={question.id} className="space-y-3">
            <Label className="text-base font-medium">
              {index + 1}. {t(translationMap.label as any)} *
            </Label>

            <RadioGroup
              value={data[question.field as keyof typeof data] as string || ''}
              onValueChange={(value) => onChange({ [question.field]: value })}
              className="grid grid-cols-1 md:grid-cols-2 gap-2"
            >
              {question.options.map((option) => {
                const isSelected = data[question.field as keyof typeof data] === option.value
                const optionTranslationKey = translationMap.options[option.value]
                return (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                        : 'border-border hover:bg-muted/50 hover:border-input'
                    }`}
                    onClick={() => onChange({ [question.field]: option.value })}
                  >
                    <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} className="mt-0.5" />
                    <Label
                      htmlFor={`${question.id}-${option.value}`}
                      className={`flex-1 cursor-pointer font-normal leading-relaxed ${isSelected ? 'text-blue-900' : ''}`}
                    >
                      {t(optionTranslationKey as any)}
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>

            {errors[question.field] && (
              <p className="text-sm text-red-500">{errors[question.field]}</p>
            )}
          </div>
        )
      })}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button onClick={onNext} disabled={!isValid()}>
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
