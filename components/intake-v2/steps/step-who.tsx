'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { WHO_QUESTIONS } from '@/lib/config/questionnaire-v2'
import { TEST_WHO_DATA, SHOW_AUTOFILL } from '@/lib/config/intake-test-data'
import type { IntakeV2StepProps } from '@/lib/types/intake-v2'
import { Zap } from 'lucide-react'

/**
 * Step 2: WHO Questions (Q05-Q10)
 * Profile quality assessment - 6 radio groups
 */
export function StepWho({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
  const questions = Object.values(WHO_QUESTIONS)

  const isValid = () => {
    return questions.every(q => {
      const value = data[q.field as keyof typeof data]
      return value && String(value).trim() !== ''
    })
  }

  const handleAutofill = () => {
    onChange(TEST_WHO_DATA)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Votre profil</h2>
          <p className="text-muted-foreground">
            Ces questions nous aident à mieux comprendre votre parcours et votre expérience.
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

      {questions.map((question, index) => (
        <div key={question.id} className="space-y-3">
          <Label className="text-base font-medium">
            {index + 1}. {question.label} *
          </Label>

          <RadioGroup
            value={data[question.field as keyof typeof data] as string || ''}
            onValueChange={(value) => onChange({ [question.field]: value })}
            className="space-y-2"
          >
            {question.options.map((option) => (
              <div
                key={option.value}
                className="flex items-start space-x-3 p-3 rounded-md border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onChange({ [question.field]: option.value })}
              >
                <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} className="mt-0.5" />
                <Label
                  htmlFor={`${question.id}-${option.value}`}
                  className="flex-1 cursor-pointer font-normal leading-relaxed"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {errors[question.field] && (
            <p className="text-sm text-red-500">{errors[question.field]}</p>
          )}
        </div>
      ))}

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
