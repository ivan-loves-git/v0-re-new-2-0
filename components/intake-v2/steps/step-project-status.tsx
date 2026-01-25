'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PROJECT_STATUS_QUESTION } from '@/lib/config/questionnaire-v2'
import { TEST_PROJECT_STATUS_DATA, SHOW_AUTOFILL } from '@/lib/config/intake-test-data'
import type { IntakeV2StepProps } from '@/lib/types/intake-v2'
import { Info, Zap } from 'lucide-react'

/**
 * Step 3: Project Status (Q11)
 * Multi-select checkbox group - highest selected option counts for WHEN score
 */
export function StepProjectStatus({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
  const question = PROJECT_STATUS_QUESTION.q11
  const selectedValues = data.q11_project_status || []

  const toggleOption = (value: string) => {
    const current = [...selectedValues]
    const index = current.indexOf(value)

    if (index === -1) {
      current.push(value)
    } else {
      current.splice(index, 1)
    }

    onChange({ q11_project_status: current })
  }

  // Find the highest scoring selected option
  const getHighestSelected = () => {
    if (selectedValues.length === 0) return null

    let highest = { value: '', points: -1 }
    for (const option of question.options) {
      if (selectedValues.includes(option.value) && option.points > highest.points) {
        highest = option
      }
    }
    return highest.value ? highest : null
  }

  const highestSelected = getHighestSelected()

  const isValid = () => {
    return selectedValues.length > 0
  }

  const handleAutofill = () => {
    onChange(TEST_PROJECT_STATUS_DATA)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Votre projet</h2>
          <p className="text-muted-foreground">
            Où en êtes-vous dans votre projet de reprise d'entreprise ?
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
            Remplir cette étape
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">
          {question.label} *
        </Label>

        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
          <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-blue-700 dark:text-blue-300">
            {question.helpText}
          </p>
        </div>

        <div className="space-y-2">
          {question.options.map((option) => {
            const isSelected = selectedValues.includes(option.value)
            const isHighest = highestSelected?.value === option.value

            return (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                  isSelected
                    ? isHighest
                      ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-300'
                      : 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => toggleOption(option.value)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOption(option.value)}
                  id={`q11-${option.value}`}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`q11-${option.value}`}
                    className={`cursor-pointer font-normal leading-relaxed ${isSelected ? 'text-blue-900' : ''}`}
                  >
                    {option.label}
                  </Label>
                  {isHighest && selectedValues.length > 1 && (
                    <span className="ml-2 text-xs text-blue-700 font-medium bg-blue-200 px-2 py-0.5 rounded">
                      étape la plus avancée
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {errors.q11_project_status && (
          <p className="text-sm text-red-500">{errors.q11_project_status}</p>
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
