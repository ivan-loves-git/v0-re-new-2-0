"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, FileText, Calculator, Check } from "lucide-react"
import { saveQuestionnaire, type QuestionnaireInput } from "@/lib/actions/repreneurs"
import {
  EMPLOYMENT_STATUS_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  EXECUTIVE_ROLE_OPTIONS,
  JOURNEY_STAGE_OPTIONS,
  INVESTMENT_CAPACITY_OPTIONS,
  FUNDING_STATUS_OPTIONS,
  NETWORK_TRAINING_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS,
} from "@/lib/utils/tier1-scoring"
import type { Repreneur } from "@/lib/types/repreneur"

interface QuestionnaireFormProps {
  repreneur: Repreneur
}

export function QuestionnaireForm({ repreneur }: QuestionnaireFormProps) {
  const [isExpanded, setIsExpanded] = useState(!repreneur.questionnaire_completed_at)
  const [isSaving, setIsSaving] = useState(false)
  const [savedScore, setSavedScore] = useState<number | null>(repreneur.tier1_score ?? null)

  // Form state
  const [formData, setFormData] = useState<QuestionnaireInput>({
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
      const result = await saveQuestionnaire(repreneur.id, formData)
      setSavedScore(result.total)
      setIsExpanded(false)
    } catch (error) {
      console.error("Failed to save questionnaire:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleMultiSelect = (field: keyof QuestionnaireInput, value: string) => {
    const current = formData[field] as string[]
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    setFormData({ ...formData, [field]: updated })
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
          {/* Section 1: Professional Background */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Professional Background</h3>

            {/* Q1: Employment Status */}
            <div className="space-y-2">
              <Label>Q1. Current employment status</Label>
              <Select
                value={formData.q1_employment_status ?? ""}
                onValueChange={(v) => setFormData({ ...formData, q1_employment_status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Q2: Years of Experience */}
            <div className="space-y-2">
              <Label>Q2. Years of professional experience</Label>
              <Select
                value={formData.q2_years_experience ?? ""}
                onValueChange={(v) => setFormData({ ...formData, q2_years_experience: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range..." />
                </SelectTrigger>
                <SelectContent>
                  {YEARS_EXPERIENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Q3: Industry Sectors */}
            <div className="space-y-2">
              <Label>Q3. Industry sectors of experience (select all that apply)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {INDUSTRY_SECTOR_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q3-${opt.value}`}
                      checked={formData.q3_industry_sectors.includes(opt.value)}
                      onCheckedChange={() => toggleMultiSelect("q3_industry_sectors", opt.value)}
                    />
                    <label htmlFor={`q3-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q5: Team Size */}
            <div className="space-y-2">
              <Label>Q5. Largest team size managed</Label>
              <Select
                value={formData.q5_team_size ?? ""}
                onValueChange={(v) => setFormData({ ...formData, q5_team_size: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size..." />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Q8: Executive Roles */}
            <div className="space-y-2">
              <Label>Q8. Executive roles held (select all that apply)</Label>
              <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                {EXECUTIVE_ROLE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q8-${opt.value}`}
                      checked={formData.q8_executive_roles.includes(opt.value)}
                      onCheckedChange={() => toggleMultiSelect("q8_executive_roles", opt.value)}
                    />
                    <label htmlFor={`q8-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: M&A Experience */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">M&A Experience</h3>

            {/* Q4: Has M&A Experience */}
            <div className="space-y-2">
              <Label>Q4. Do you have M&A experience?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.q4_has_ma_experience === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q4_has_ma_experience: true })}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={formData.q4_has_ma_experience === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q4_has_ma_experience: false })}
                >
                  No
                </Button>
              </div>
            </div>

            {/* Q6: Involved in M&A */}
            <div className="space-y-2">
              <Label>Q6. Have you been directly involved in M&A transactions?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.q6_involved_in_ma === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q6_involved_in_ma: true })}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={formData.q6_involved_in_ma === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q6_involved_in_ma: false })}
                >
                  No
                </Button>
              </div>
            </div>

            {/* Q7: M&A Details */}
            {(formData.q4_has_ma_experience || formData.q6_involved_in_ma) && (
              <div className="space-y-2">
                <Label>Q7. Describe your M&A experience</Label>
                <Textarea
                  value={formData.q7_ma_details ?? ""}
                  onChange={(e) => setFormData({ ...formData, q7_ma_details: e.target.value })}
                  placeholder="Describe your experience with acquisitions, sales, or other M&A transactions..."
                  rows={3}
                />
              </div>
            )}

            {/* Q9: Board Experience */}
            <div className="space-y-2">
              <Label>Q9. Do you have board or advisory experience?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.q9_board_experience === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q9_board_experience: true })}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={formData.q9_board_experience === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q9_board_experience: false })}
                >
                  No
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Acquisition Journey */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Acquisition Journey</h3>

            {/* Q10: Journey Stages */}
            <div className="space-y-2">
              <Label>Q10. Current journey stage (select all that apply)</Label>
              <div className="space-y-2 border rounded-md p-3">
                {JOURNEY_STAGE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q10-${opt.value}`}
                      checked={formData.q10_journey_stages.includes(opt.value)}
                      onCheckedChange={() => toggleMultiSelect("q10_journey_stages", opt.value)}
                    />
                    <label htmlFor={`q10-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q11: Target Sectors */}
            <div className="space-y-2">
              <Label>Q11. Target acquisition sectors (select all that apply)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {INDUSTRY_SECTOR_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q11-${opt.value}`}
                      checked={formData.q11_target_sectors.includes(opt.value)}
                      onCheckedChange={() => toggleMultiSelect("q11_target_sectors", opt.value)}
                    />
                    <label htmlFor={`q11-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q12: Has Identified Targets */}
            <div className="space-y-2">
              <Label>Q12. Have you identified specific acquisition targets?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.q12_has_identified_targets === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q12_has_identified_targets: true })}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={formData.q12_has_identified_targets === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q12_has_identified_targets: false })}
                >
                  No
                </Button>
              </div>
            </div>

            {/* Q13: Target Details */}
            {formData.q12_has_identified_targets && (
              <div className="space-y-2">
                <Label>Q13. Describe your identified targets</Label>
                <Textarea
                  value={formData.q13_target_details ?? ""}
                  onChange={(e) => setFormData({ ...formData, q13_target_details: e.target.value })}
                  placeholder="CA, number of employees, valuation range, sector..."
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Section 4: Financial Readiness */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Financial Readiness</h3>

            {/* Q14: Investment Capacity */}
            <div className="space-y-2">
              <Label>Q14. Investment capacity</Label>
              <Select
                value={formData.q14_investment_capacity ?? ""}
                onValueChange={(v) => setFormData({ ...formData, q14_investment_capacity: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range..." />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_CAPACITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Q15: Funding Status */}
            <div className="space-y-2">
              <Label>Q15. Funding status</Label>
              <Select
                value={formData.q15_funding_status ?? ""}
                onValueChange={(v) => setFormData({ ...formData, q15_funding_status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {FUNDING_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 5: Network & Preferences */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Network & Preferences</h3>

            {/* Q16: Network/Training */}
            <div className="space-y-2">
              <Label>Q16. Network or training affiliations (select all that apply)</Label>
              <div className="flex flex-wrap gap-2 border rounded-md p-3">
                {NETWORK_TRAINING_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q16-${opt.value}`}
                      checked={formData.q16_network_training.includes(opt.value)}
                      onCheckedChange={() => toggleMultiSelect("q16_network_training", opt.value)}
                    />
                    <label htmlFor={`q16-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q17: Open to Co-acquisition */}
            <div className="space-y-2">
              <Label>Q17. Open to co-acquisition?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.q17_open_to_co_acquisition === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q17_open_to_co_acquisition: true })}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={formData.q17_open_to_co_acquisition === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, q17_open_to_co_acquisition: false })}
                >
                  No
                </Button>
              </div>
            </div>
          </div>

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
