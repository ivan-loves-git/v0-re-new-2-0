'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { WHEN_QUESTIONS } from '@/lib/config/questionnaire-v2'
import type { IntakeV2StepProps } from '@/lib/types/intake-v2'
import { Info } from 'lucide-react'

/**
 * Step 4: WHEN Questions (Q12-Q16)
 * Project maturity assessment - mix of multi-select and single select
 */
export function StepWhen({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
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

  const renderMultiSelect = (question: typeof WHEN_QUESTIONS.q12) => {
    const selectedValues = (data[question.field as keyof typeof data] as string[]) || []

    return (
      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedValues.includes(option.value)
          return (
            <div
              key={option.value}
              className={`flex items-center space-x-3 p-3 rounded-md border transition-colors cursor-pointer ${
                isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
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
                className="flex-1 cursor-pointer font-normal"
              >
                {option.label}
              </Label>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Vos critères de recherche</h2>
        <p className="text-muted-foreground">
          Ces informations nous aident à évaluer la cohérence financière de votre projet.
        </p>
      </div>

      {/* Q12: Geographic Zones */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {WHEN_QUESTIONS.q12.label} *
        </Label>
        {renderMultiSelect(WHEN_QUESTIONS.q12)}
        {errors.q12_geo_zones && (
          <p className="text-sm text-red-500">{errors.q12_geo_zones}</p>
        )}
      </div>

      {/* Q13: Target Sectors */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {WHEN_QUESTIONS.q13.label} *
        </Label>
        {renderMultiSelect(WHEN_QUESTIONS.q13)}
        {errors.q13_target_sectors_v2 && (
          <p className="text-sm text-red-500">{errors.q13_target_sectors_v2}</p>
        )}
      </div>

      {/* Q14: Deal Size */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {WHEN_QUESTIONS.q14.label} *
        </Label>
        {'helpText' in WHEN_QUESTIONS.q14 && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
            <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-blue-700 dark:text-blue-300">
              {WHEN_QUESTIONS.q14.helpText}
            </p>
          </div>
        )}
        {renderMultiSelect(WHEN_QUESTIONS.q14)}
        {errors.q14_deal_size && (
          <p className="text-sm text-red-500">{errors.q14_deal_size}</p>
        )}
      </div>

      {/* Q15: Capital Structure */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {WHEN_QUESTIONS.q15.label} *
        </Label>
        {'helpText' in WHEN_QUESTIONS.q15 && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
            <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-blue-700 dark:text-blue-300">
              {WHEN_QUESTIONS.q15.helpText}
            </p>
          </div>
        )}
        {renderMultiSelect(WHEN_QUESTIONS.q15)}
        {errors.q15_structure && (
          <p className="text-sm text-red-500">{errors.q15_structure}</p>
        )}
      </div>

      {/* Q16: Equity Contribution (Single Select) */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {WHEN_QUESTIONS.q16.label} *
        </Label>

        <RadioGroup
          value={data.q16_equity || ''}
          onValueChange={(value) => onChange({ q16_equity: value })}
          className="space-y-2"
        >
          {WHEN_QUESTIONS.q16.options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 p-3 rounded-md border hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => onChange({ q16_equity: option.value })}
            >
              <RadioGroupItem value={option.value} id={`q16-${option.value}`} />
              <Label
                htmlFor={`q16-${option.value}`}
                className="flex-1 cursor-pointer font-normal"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {errors.q16_equity && (
          <p className="text-sm text-red-500">{errors.q16_equity}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!isValid()}>
          Continuer
        </Button>
      </div>
    </div>
  )
}
