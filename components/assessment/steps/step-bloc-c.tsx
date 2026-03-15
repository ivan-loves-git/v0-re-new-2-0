'use client'

import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { BLOC_C_QUESTIONS, LIKERT_LABELS } from '@/lib/config/leadership-assessment'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { AssessmentStepProps, BlocCAnswer } from '@/lib/types/leadership-assessment'

const LIKERT_VALUES = [1, 2, 3, 4, 5] as const

export function StepBlocC({ data, onChange, onNext, onBack, errors }: AssessmentStepProps) {
  const { language } = useLanguage()

  const allAnswered = BLOC_C_QUESTIONS.every(q => data[q.id as keyof typeof data] != null)

  const handleSelect = (questionId: string, value: BlocCAnswer) => {
    onChange({ [questionId]: value } as any)
  }

  const title = language === 'fr' ? 'Auto-evaluation' : 'Self-Assessment'
  const subtitle = language === 'fr'
    ? 'Indiquez dans quelle mesure vous etes d\'accord avec chaque affirmation.'
    : 'Indicate how much you agree with each statement.'
  const nextLabel = language === 'fr' ? 'Continuer' : 'Continue'
  const backLabel = language === 'fr' ? 'Retour' : 'Back'

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-8">
        {BLOC_C_QUESTIONS.map((question, index) => {
          const questionLabel = language === 'fr' ? question.label : question.labelEn
          const selectedValue = data[question.id as keyof typeof data] as BlocCAnswer | undefined

          return (
            <div key={question.id} className="space-y-3">
              <p className="font-medium text-sm">
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                {questionLabel}
              </p>

              {/* Likert scale */}
              <div className="space-y-2">
                {/* Scale buttons */}
                <div className="flex gap-2 justify-between">
                  {LIKERT_VALUES.map(value => {
                    const isSelected = selectedValue === value
                    const label = language === 'fr'
                      ? LIKERT_LABELS[value].fr
                      : LIKERT_LABELS[value].en

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleSelect(question.id, value)}
                        title={label}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all',
                          isSelected
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600'
                            : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50'
                        )}
                      >
                        <span className="text-sm font-semibold">{value}</span>
                        <span className="text-[10px] leading-tight text-muted-foreground text-center hidden sm:block">
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Mobile-only: show labels at the extremes */}
                <div className="flex justify-between text-[10px] text-muted-foreground sm:hidden">
                  <span>{language === 'fr' ? LIKERT_LABELS[1].fr : LIKERT_LABELS[1].en}</span>
                  <span>{language === 'fr' ? LIKERT_LABELS[5].fr : LIKERT_LABELS[5].en}</span>
                </div>
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
