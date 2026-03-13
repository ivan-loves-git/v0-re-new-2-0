'use client'

import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  BLOC_A_QUESTIONS,
  BLOC_B_QUESTIONS,
  BLOC_C_QUESTIONS,
  LIKERT_LABELS,
} from '@/lib/config/leadership-assessment'
import { ArrowLeft, Pencil, Send, Loader2 } from 'lucide-react'
import type { AssessmentStepProps, BlocAAnswer, BlocBAnswer, BlocCAnswer } from '@/lib/types/leadership-assessment'

interface StepReviewProps extends AssessmentStepProps {
  onEditStep: (step: number) => void
  onSubmit: () => void
}

export function StepReview({ data, onBack, onEditStep, onSubmit, isSubmitting }: StepReviewProps) {
  const { language } = useLanguage()

  const title = language === 'fr' ? 'Verification de vos reponses' : 'Review your answers'
  const subtitle = language === 'fr'
    ? 'Verifiez vos reponses avant de soumettre. Vous pouvez modifier une section en cliquant sur "Modifier".'
    : 'Review your answers before submitting. You can edit a section by clicking "Edit".'
  const editLabel = language === 'fr' ? 'Modifier' : 'Edit'
  const submitLabel = language === 'fr' ? 'Soumettre mes reponses' : 'Submit my answers'
  const submittingLabel = language === 'fr' ? 'Envoi en cours...' : 'Submitting...'
  const backLabel = language === 'fr' ? 'Retour' : 'Back'

  const blocATitle = language === 'fr' ? 'Bloc A - Profil de leadership' : 'Bloc A - Leadership Profile'
  const blocBTitle = language === 'fr' ? 'Bloc B - Mises en situation' : 'Bloc B - Situational Scenarios'
  const blocCTitle = language === 'fr' ? 'Bloc C - Auto-evaluation' : 'Bloc C - Self-Assessment'

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Bloc A Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{blocATitle}</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
            <Pencil className="w-3 h-3 mr-1" />
            {editLabel}
          </Button>
        </div>
        <div className="space-y-2 bg-muted/30 rounded-lg p-4">
          {BLOC_A_QUESTIONS.map((question, index) => {
            const questionLabel = language === 'fr' ? question.label : question.labelEn
            const answer = data[question.id as keyof typeof data] as BlocAAnswer | undefined
            let answerLabel = '—'
            if (answer === 'A') {
              answerLabel = language === 'fr' ? question.optionA.label : question.optionA.labelEn
            } else if (answer === 'B') {
              answerLabel = language === 'fr' ? question.optionB.label : question.optionB.labelEn
            }

            return (
              <div key={question.id} className="text-sm">
                <p className="text-muted-foreground">
                  <span className="mr-1">{index + 1}.</span>
                  {questionLabel}
                </p>
                <p className="font-medium ml-4 mt-0.5">{answerLabel}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bloc B Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{blocBTitle}</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
            <Pencil className="w-3 h-3 mr-1" />
            {editLabel}
          </Button>
        </div>
        <div className="space-y-2 bg-muted/30 rounded-lg p-4">
          {BLOC_B_QUESTIONS.map((question, index) => {
            const situationText = language === 'fr' ? question.situation : question.situationEn
            const answer = data[question.id as keyof typeof data] as BlocBAnswer | undefined
            const selectedOption = answer
              ? question.options.find(o => o.value === answer)
              : undefined
            const answerLabel = selectedOption
              ? (language === 'fr' ? selectedOption.label : selectedOption.labelEn)
              : '—'

            return (
              <div key={question.id} className="text-sm">
                <p className="text-muted-foreground">
                  <span className="mr-1">{index + 1}.</span>
                  {situationText}
                </p>
                <p className="font-medium ml-4 mt-0.5">{answerLabel}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bloc C Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{blocCTitle}</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
            <Pencil className="w-3 h-3 mr-1" />
            {editLabel}
          </Button>
        </div>
        <div className="space-y-2 bg-muted/30 rounded-lg p-4">
          {BLOC_C_QUESTIONS.map((question, index) => {
            const questionLabel = language === 'fr' ? question.label : question.labelEn
            const answer = data[question.id as keyof typeof data] as BlocCAnswer | undefined
            const answerLabel = answer
              ? `${answer}/5 — ${language === 'fr' ? LIKERT_LABELS[answer].fr : LIKERT_LABELS[answer].en}`
              : '—'

            return (
              <div key={question.id} className="text-sm">
                <p className="text-muted-foreground">
                  <span className="mr-1">{index + 1}.</span>
                  {questionLabel}
                </p>
                <p className="font-medium ml-4 mt-0.5">{answerLabel}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        )}
        <div className="ml-auto">
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {submittingLabel}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
