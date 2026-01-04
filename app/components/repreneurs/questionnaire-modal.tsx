"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calculator, Loader2 } from "lucide-react"
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

interface QuestionnaireModalProps {
  repreneur: Repreneur
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (score: number) => void
}

export function QuestionnaireModal({ repreneur, open, onOpenChange, onSaved }: QuestionnaireModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)

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
      onSaved?.(result.total)
      onOpenChange(false)
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

  const sections = [
    { title: "Professional Background", description: "Experience and career history" },
    { title: "M&A Experience", description: "Mergers and acquisitions background" },
    { title: "Acquisition Journey", description: "Current stage and targets" },
    { title: "Financial Readiness", description: "Investment capacity and funding" },
    { title: "Network & Preferences", description: "Affiliations and preferences" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Intake Questionnaire</DialogTitle>
          <DialogDescription>
            Fill out the questionnaire to calculate the Tier 1 score for {repreneur.first_name} {repreneur.last_name}
          </DialogDescription>
        </DialogHeader>

        {/* Section tabs */}
        <div className="flex gap-1 border-b pb-2 overflow-x-auto">
          {sections.map((section, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSection(idx)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                currentSection === idx
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {idx + 1}. {section.title}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Section 1: Professional Background */}
          {currentSection === 0 && (
            <div className="space-y-4">
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

              <div className="space-y-2">
                <Label>Q3. Industry sectors of experience</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
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

              <div className="space-y-2">
                <Label>Q8. Executive roles held</Label>
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
          )}

          {/* Section 2: M&A Experience */}
          {currentSection === 1 && (
            <div className="space-y-4">
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
          )}

          {/* Section 3: Acquisition Journey */}
          {currentSection === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Q10. Current journey stage</Label>
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

              <div className="space-y-2">
                <Label>Q11. Target acquisition sectors</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
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
          )}

          {/* Section 4: Financial Readiness */}
          {currentSection === 3 && (
            <div className="space-y-4">
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
          )}

          {/* Section 5: Network & Preferences */}
          {currentSection === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Q16. Network or training affiliations</Label>
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
          )}
        </div>

        {/* Footer with navigation and save */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
              disabled={currentSection === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
              disabled={currentSection === sections.length - 1}
            >
              Next
            </Button>
          </div>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Score & Save
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
