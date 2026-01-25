"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X, Info } from "lucide-react"
import { toast } from "sonner"
import { updateCriterion, updateQuestionLabel } from "@/lib/actions/evaluation-criteria"
import type { EvaluationQuestion, EvaluationTier } from "@/lib/types/evaluation-criteria"

interface CriteriaQuestionCardProps {
  question: EvaluationQuestion
  tier: EvaluationTier
  questionNumber: number
}

export function CriteriaQuestionCard({
  question,
  tier,
  questionNumber,
}: CriteriaQuestionCardProps) {
  const [isEditingQuestion, setIsEditingQuestion] = useState(false)
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [questionLabel, setQuestionLabel] = useState(question.question_label)
  const [editedOption, setEditedOption] = useState<{
    label: string
    score: string
  }>({ label: "", score: "" })
  const [isLoading, setIsLoading] = useState(false)

  const handleSaveQuestion = async () => {
    if (!questionLabel.trim()) {
      toast.error("Question label cannot be empty")
      return
    }

    setIsLoading(true)
    try {
      await updateQuestionLabel(question.question_key, tier, questionLabel.trim())
      setIsEditingQuestion(false)
      toast.success("Question label updated")
    } catch (error) {
      toast.error("Failed to update question label")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelQuestion = () => {
    setQuestionLabel(question.question_label)
    setIsEditingQuestion(false)
  }

  const handleStartEditOption = (option: {
    id: string
    option_label: string
    option_score: number | null
  }) => {
    setEditingOptionId(option.id)
    setEditedOption({
      label: option.option_label,
      score: option.option_score?.toString() ?? "",
    })
  }

  const handleSaveOption = async (optionId: string) => {
    if (!editedOption.label.trim()) {
      toast.error("Option label cannot be empty")
      return
    }

    setIsLoading(true)
    try {
      await updateCriterion(optionId, {
        option_label: editedOption.label.trim(),
        option_score: editedOption.score ? parseFloat(editedOption.score) : null,
      })
      setEditingOptionId(null)
      toast.success("Option updated")
    } catch (error) {
      toast.error("Failed to update option")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelOption = () => {
    setEditingOptionId(null)
    setEditedOption({ label: "", score: "" })
  }

  // Handle informational questions (no editable options)
  if (question.is_informational) {
    return (
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
              {questionNumber}
            </span>
            <div className="flex items-center gap-2 flex-1">
              {isEditingQuestion ? (
                <>
                  <Input
                    value={questionLabel}
                    onChange={(e) => setQuestionLabel(e.target.value)}
                    className="flex-1 h-8"
                    disabled={isLoading}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleSaveQuestion}
                    disabled={isLoading}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleCancelQuestion}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-gray-700">{question.question_label}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setIsEditingQuestion(true)}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Info className="h-4 w-4" />
            <span>Question contextuelle ou score calculé automatiquement</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
            {questionNumber}
          </span>
          <div className="flex items-center gap-2 flex-1">
            {isEditingQuestion ? (
              <>
                <Input
                  value={questionLabel}
                  onChange={(e) => setQuestionLabel(e.target.value)}
                  className="flex-1 h-8"
                  disabled={isLoading}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleSaveQuestion}
                  disabled={isLoading}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleCancelQuestion}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 text-gray-500" />
                </Button>
              </>
            ) : (
              <>
                <span className="font-medium text-gray-900">
                  {question.question_label}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setIsEditingQuestion(true)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {question.options.map((option) => (
            <div
              key={option.id}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 group/option"
            >
              {editingOptionId === option.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editedOption.label}
                    onChange={(e) =>
                      setEditedOption({ ...editedOption, label: e.target.value })
                    }
                    placeholder="Option label"
                    className="flex-1 h-8"
                    disabled={isLoading}
                  />
                  <Input
                    type="number"
                    step="0.5"
                    value={editedOption.score}
                    onChange={(e) =>
                      setEditedOption({ ...editedOption, score: e.target.value })
                    }
                    placeholder="Score"
                    className="w-20 h-8"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-500">pts</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleSaveOption(option.id)}
                    disabled={isLoading}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleCancelOption}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-700">{option.option_label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 tabular-nums">
                      {option.option_score ?? "-"} pts
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleStartEditOption(option)}
                      className="opacity-0 group-hover/option:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3 w-3 text-gray-400" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
