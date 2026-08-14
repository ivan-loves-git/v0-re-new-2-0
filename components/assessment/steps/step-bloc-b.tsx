'use client'

import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { BLOC_B_QUESTIONS } from '@/lib/config/leadership-assessment'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { AssessmentStepProps } from '@/lib/types/leadership-assessment'
import type { BlocBAnswer } from '@/lib/types/leadership-assessment'

export function StepBlocB({ data, onChange, onNext, onBack, errors }: AssessmentStepProps) {
  const { language } = useLanguage()

  const allAnswered = BLOC_B_QUESTIONS.every(q => data[q.id as keyof typeof data] != null)

  const handleSelect = (questionId: string, value: BlocBAnswer) => {
    onChange({ [questionId]: value } as any)
  }

  const title = language === 'fr' ? 'Mises en situation' : 'Situational Scenarios'
  const subtitle = language === 'fr'
    ? 'Pour chaque situation, choisissez la reaction qui vous semble la plus adaptee.'
    : 'For each situation, choose the response that seems most appropriate to you.'
  const nextLabel = language === 'fr' ? 'Continuer' : 'Continue'
  const backLabel = language === 'fr' ? 'Retour' : 'Back'

  const optionLetters = ['A', 'B', 'C', 'D'] as const

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-8">
        {BLOC_B_QUESTIONS.map((question, index) => {
          const situationText = language === 'fr' ? question.situation : question.situationEn
          const selectedValue = data[question.id as keyof typeof data] as BlocBAnswer | undefined

          return (
            <div key={question.id} className="space-y-3">
              {/* Situation context */}
              <div className="bg-muted/50 border rounded-lg p-3">
                <p className="font-medium text-sm">
                  <span className="text-muted-foreground mr-2">{index + 1}.</span>
                  {situationText}
                </p>
              </div>

              {/* Options */}
              <div className="grid gap-2 pl-2">
                {question.options.map((option, optIndex) => {
                  const optionLabel = language === 'fr' ? option.label : option.labelEn
                  const isSelected = selectedValue === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(question.id, option.value)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border-2 transition-[background-color,border-color,box-shadow,color] duration-wave-fast ease-wave-out text-sm',
                        isSelected
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50'
                      )}
                    >
                      <span className="font-medium text-muted-foreground mr-2">
                        {optionLetters[optIndex]}.
                      </span>
                      {optionLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-4">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4 mr-2" />
            {backLabel}
          </Button>
        )}
        <div className="ml-auto">
          <Button onClick={onNext} disabled={!allAnswered}>
            {nextLabel}
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
