"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, FileText, Calculator, Check } from "lucide-react"
import { saveQuestionnaire, type QuestionnaireInput } from "@/lib/actions/repreneurs"
import {
  INTERNAL_STEPS,
  type QuestionnaireFormData,
  type FormHandlers,
} from "@/components/questionnaire"
import { SectionRenderer } from "@/components/questionnaire/step-renderer"
import type { Repreneur } from "@/lib/types/repreneur"

interface QuestionnaireFormProps {
  repreneur: Repreneur
}

export function QuestionnaireForm({ repreneur }: QuestionnaireFormProps) {
  const [isExpanded, setIsExpanded] = useState(!repreneur.questionnaire_completed_at)
  const [isSaving, setIsSaving] = useState(false)
  const [savedScore, setSavedScore] = useState<number | null>(repreneur.tier1_score ?? null)

  // Form state initialized from repreneur data
  const [formData, setFormData] = useState<QuestionnaireFormData>({
    q1_employment_status: repreneur.q1_employment_status ?? null,
    q2_years_experience: repreneur.q2_years_experience ?? null,
    q3_industry_sectors: repreneur.q3_industry_sectors ?? [],
    q4_has_ma_experience: repreneur.q4_has_ma_experience ?? null,
    q5_team_size: repreneur.q5_team_size ?? null,
    q6_involved_in_ma: repreneur.q6_involved_in_ma ?? null,
    q7_ma_details: repreneur.q7_ma_details ?? null,
    q8_executive_roles: repreneur.q8_executive_roles ?? [],
    q9_board_experience: repreneur.q9_board_experience ?? null,
    q10_journey_stages: repreneur.q10_journey_stages ?? [],
    q11_target_sectors: repreneur.q11_target_sectors ?? [],
    q12_has_identified_targets: repreneur.q12_has_identified_targets ?? null,
    q13_target_details: repreneur.q13_target_details ?? null,
    q14_investment_capacity: repreneur.q14_investment_capacity ?? null,
    q15_funding_status: repreneur.q15_funding_status ?? null,
    q16_network_training: repreneur.q16_network_training ?? [],
    q17_open_to_co_acquisition: repreneur.q17_open_to_co_acquisition ?? null,
  })

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      // Convert to the expected QuestionnaireInput format
      const input: QuestionnaireInput = {
        q1_employment_status: formData.q1_employment_status,
        q2_years_experience: formData.q2_years_experience,
        q3_industry_sectors: formData.q3_industry_sectors,
        q4_has_ma_experience: formData.q4_has_ma_experience,
        q5_team_size: formData.q5_team_size,
        q6_involved_in_ma: formData.q6_involved_in_ma,
        q7_ma_details: formData.q7_ma_details,
        q8_executive_roles: formData.q8_executive_roles,
        q9_board_experience: formData.q9_board_experience,
        q10_journey_stages: formData.q10_journey_stages,
        q11_target_sectors: formData.q11_target_sectors,
        q12_has_identified_targets: formData.q12_has_identified_targets,
        q13_target_details: formData.q13_target_details,
        q14_investment_capacity: formData.q14_investment_capacity,
        q15_funding_status: formData.q15_funding_status,
        q16_network_training: formData.q16_network_training,
        q17_open_to_co_acquisition: formData.q17_open_to_co_acquisition,
      }
      const result = await saveQuestionnaire(repreneur.id, input)
      setSavedScore(result.total)
      setIsExpanded(false)
    } catch (error) {
      console.error("Failed to save questionnaire:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Form handlers for shared components
  const handlers: FormHandlers = {
    updateField: (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }))
    },
    toggleArrayField: (field, value) => {
      const current = formData[field] as string[]
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      setFormData(prev => ({ ...prev, [field]: updated }))
    },
  }

  const isCompleted = !!repreneur.questionnaire_completed_at

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>Intake Questionnaire</CardTitle>
              <CardDescription>
                {isCompleted
                  ? `Completed - Score: ${savedScore ?? repreneur.tier1_score} points`
                  : "Fill out the questionnaire to calculate Tier 1 score"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Check className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-8">
          {/* Render each section using shared components */}
          {INTERNAL_STEPS.map((step) => (
            <SectionRenderer
              key={step.id}
              title={step.title}
              questions={step.questions}
              formData={formData}
              handlers={handlers}
            />
          ))}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSubmit} disabled={isSaving}>
              <Calculator className="h-4 w-4 mr-2" />
              {isSaving ? "Calculating..." : "Calculate Score & Save"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
