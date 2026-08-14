'use client'

import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { BLOC_A_QUESTIONS } from '@/lib/config/leadership-assessment'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import type { AssessmentStepProps } from '@/lib/types/leadership-assessment'
import type { BlocAAnswer } from '@/lib/types/leadership-assessment'

export function StepBlocA({ data, onChange, onNext, errors }: AssessmentStepProps) {
  const { language } = useLanguage()

  const allAnswered = BLOC_A_QUESTIONS.every(q => data[q.id as keyof typeof data] != null)

  const handleSelect = (questionId: string, value: BlocAAnswer) => {
    onChange({ [questionId]: value } as any)
  }

  const title = language === 'fr' ? 'Profil de leadership' : 'Leadership Profile'
  const subtitle = language === 'fr'
    ? 'Pour chaque situation, choisissez l\'affirmation qui vous correspond le mieux. Il n\'y a pas de bonne ou de mauvaise reponse.'
    : 'For each situation, choose the statement that best describes you. There are no right or wrong answers.'
  const nextLabel = language === 'fr' ? 'Continuer' : 'Continue'

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-6">
        {BLOC_A_QUESTIONS.map((question, index) => {
          const questionLabel = language === 'fr' ? question.label : question.labelEn
          const selectedValue = data[question.id as keyof typeof data] as BlocAAnswer | undefined

          return (
            <div key={question.id} className="space-y-3">
              <p className="font-medium text-sm">
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                {questionLabel}
              </p>

              <div className="grid gap-2">
                {/* Option A */}
                <button
                  type="button"
                  onClick={() => handleSelect(question.id, 'A')}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border-2 text-sm',
                    selectedValue === 'A'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600'
                      : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50'
                  )}
                >
                  <span className="font-medium text-muted-foreground mr-2">A.</span>
                  {language === 'fr' ? question.optionA.label : question.optionA.labelEn}
                </button>

                {/* Option B */}
                <button
                  type="button"
                  onClick={() => handleSelect(question.id, 'B')}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border-2 text-sm',
                    selectedValue === 'B'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600'
                      : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50'
                  )}
                >
                  <span className="font-medium text-muted-foreground mr-2">B.</span>
                  {language === 'fr' ? question.optionB.label : question.optionB.labelEn}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!allAnswered}>
          {nextLabel}
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
