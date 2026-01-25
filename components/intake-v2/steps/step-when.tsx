'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { WHEN_QUESTIONS } from '@/lib/config/questionnaire-v2'
import { TEST_WHEN_DATA, SHOW_AUTOFILL } from '@/lib/config/intake-test-data'
import { useLanguage } from '@/lib/i18n/language-context'
import type { IntakeV2StepProps } from '@/lib/types/intake-v2'
import { Info, Zap } from 'lucide-react'

// Translation keys for WHEN questions
const WHEN_TRANSLATION_MAP: Record<string, { label: string; helpText?: string; options: Record<string, string> }> = {
  q12: {
    label: 'q12Label',
    options: {
      idf: 'q12_idf',
      north: 'q12_north',
      east: 'q12_east',
      west: 'q12_west',
      south: 'q12_south',
      all: 'q12_all',
      international: 'q12_international',
    }
  },
  q13: {
    label: 'q13Label',
    options: {
      industry: 'q13_industry',
      services: 'q13_services',
      tech: 'q13_tech',
      retail: 'q13_retail',
      health: 'q13_health',
      construction: 'q13_construction',
      agri: 'q13_agri',
      other: 'q13_other',
    }
  },
  q14: {
    label: 'q14Label',
    helpText: 'q14HelpText',
    options: {
      '1-3M': 'q14_1_3M',
      '3-5M': 'q14_3_5M',
      '>5M': 'q14_5M_plus',
    }
  },
  q15: {
    label: 'q15Label',
    helpText: 'q15HelpText',
    options: {
      majority_without_fund: 'q15_majority_without_fund',
      majority_with_minority: 'q15_majority_with_minority',
      manager_with_majority: 'q15_manager_with_majority',
      havent_thought: 'q15_havent_thought',
    }
  },
  q16: {
    label: 'q16Label',
    options: {
      tbd: 'q16_tbd',
      '151-250': 'q16_151_250',
      '251-350': 'q16_251_350',
      '351-450': 'q16_351_450',
      '>450': 'q16_450_plus',
    }
  },
}

/**
 * Step 4: WHEN Questions (Q12-Q16)
 * Project maturity assessment - mix of multi-select and single select
 */
export function StepWhen({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
  const { t } = useLanguage()

  const toggleMultiSelect = (field: string, value: string) => {
    const current = (data[field as keyof typeof data] as string[]) || []
    const updated = [...current]
    const index = updated.indexOf(value)

    if (index === -1) {
      updated.push(value)
    } else {
      updated.splice(index, 1)
    }

    onChange({ [field]: updated })
  }

  const isValid = () => {
    return (
      (data.q12_geo_zones?.length || 0) > 0 &&
      (data.q13_target_sectors_v2?.length || 0) > 0 &&
      (data.q14_deal_size?.length || 0) > 0 &&
      (data.q15_structure?.length || 0) > 0 &&
      data.q16_equity?.trim()
    )
  }

  const renderMultiSelect = (questionId: string, question: typeof WHEN_QUESTIONS.q12) => {
    const selectedValues = (data[question.field as keyof typeof data] as string[]) || []
    const translationMap = WHEN_TRANSLATION_MAP[questionId]

    return (
      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedValues.includes(option.value)
          const optionTranslationKey = translationMap.options[option.value]
          return (
            <div
              key={option.value}
              className={`flex items-center space-x-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                  : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
              onClick={() => toggleMultiSelect(question.field, option.value)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleMultiSelect(question.field, option.value)}
                id={`${question.id}-${option.value}`}
              />
              <Label
                htmlFor={`${question.id}-${option.value}`}
                className={`flex-1 cursor-pointer font-normal ${isSelected ? 'text-blue-900' : ''}`}
              >
                {t(optionTranslationKey as any)}
              </Label>
            </div>
          )
        })}
      </div>
    )
  }

  const handleAutofill = () => {
    onChange(TEST_WHEN_DATA)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">{t('step4Title')}</h2>
          <p className="text-muted-foreground">
            {t('step4Description')}
          </p>
        </div>
        {SHOW_AUTOFILL && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutofill}
            className="shrink-0 text-xs bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800"
          >
            <Zap className="h-3 w-3 mr-1" />
            {t('fillStep')}
          </Button>
        )}
      </div>

      {/* Q12: Geographic Zones */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {t('q12Label')} *
        </Label>
        {renderMultiSelect('q12', WHEN_QUESTIONS.q12)}
        {errors.q12_geo_zones && (
          <p className="text-sm text-red-500">{errors.q12_geo_zones}</p>
        )}
      </div>

      {/* Q13: Target Sectors */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {t('q13Label')} *
        </Label>
        {renderMultiSelect('q13', WHEN_QUESTIONS.q13)}
        {errors.q13_target_sectors_v2 && (
          <p className="text-sm text-red-500">{errors.q13_target_sectors_v2}</p>
        )}
      </div>

      {/* Q14: Deal Size */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {t('q14Label')} *
        </Label>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
          <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-blue-700 dark:text-blue-300">
            {t('q14HelpText')}
          </p>
        </div>
        {renderMultiSelect('q14', WHEN_QUESTIONS.q14)}
        {errors.q14_deal_size && (
          <p className="text-sm text-red-500">{errors.q14_deal_size}</p>
        )}
      </div>

      {/* Q15: Capital Structure */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {t('q15Label')} *
        </Label>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
          <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-blue-700 dark:text-blue-300">
            {t('q15HelpText')}
          </p>
        </div>
        {renderMultiSelect('q15', WHEN_QUESTIONS.q15)}
        {errors.q15_structure && (
          <p className="text-sm text-red-500">{errors.q15_structure}</p>
        )}
      </div>

      {/* Q16: Equity Contribution (Single Select) */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {t('q16Label')} *
        </Label>

        <RadioGroup
          value={data.q16_equity || ''}
          onValueChange={(value) => onChange({ q16_equity: value })}
          className="space-y-2"
        >
          {WHEN_QUESTIONS.q16.options.map((option) => {
            const isSelected = data.q16_equity === option.value
            const optionTranslationKey = WHEN_TRANSLATION_MAP.q16.options[option.value]
            return (
              <div
                key={option.value}
                className={`flex items-center space-x-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => onChange({ q16_equity: option.value })}
              >
                <RadioGroupItem value={option.value} id={`q16-${option.value}`} />
                <Label
                  htmlFor={`q16-${option.value}`}
                  className={`flex-1 cursor-pointer font-normal ${isSelected ? 'text-blue-900' : ''}`}
                >
                  {t(optionTranslationKey as any)}
                </Label>
              </div>
            )
          })}
        </RadioGroup>
        {errors.q16_equity && (
          <p className="text-sm text-red-500">{errors.q16_equity}</p>
        )}
      </div>

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
