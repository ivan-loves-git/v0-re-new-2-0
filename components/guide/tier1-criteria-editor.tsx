"use client"

import { CriteriaQuestionCard } from "./criteria-question-card"
import { AlertCircle } from "lucide-react"
import type { EvaluationQuestion } from "@/lib/types/evaluation-criteria"

interface Tier1CriteriaEditorProps {
  questions: EvaluationQuestion[]
}

export function Tier1CriteriaEditor({ questions }: Tier1CriteriaEditorProps) {
  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">Changes only affect future candidates</p>
          <p className="mt-1 text-blue-700">
            Existing repreneur scores are frozen at the time of their evaluation.
            Modifying criteria here will only impact new repreneurs who complete
            the questionnaire after the change.
          </p>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <CriteriaQuestionCard
            key={question.question_key}
            question={question}
            tier="tier1"
            questionNumber={index + 1}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500 text-center py-4 border-t">
        {questions.length} questions in Tier 1 evaluation
      </div>
    </div>
  )
}
