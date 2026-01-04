"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, ArrowRight, Calculator, Loader2, Check, X } from "lucide-react"
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

// Extended options with skip/N/A where reasonable
const EMPLOYMENT_STATUS_WITH_SKIP = [
  ...EMPLOYMENT_STATUS_OPTIONS,
  { value: "skip", label: "Prefer not to say", score: 0 },
]

const TEAM_SIZE_WITH_SKIP = [
  ...TEAM_SIZE_OPTIONS,
  { value: "never_managed", label: "Never managed a team", score: 0 },
]

const FUNDING_STATUS_WITH_SKIP = [
  ...FUNDING_STATUS_OPTIONS,
  { value: "not_applicable", label: "Not applicable / Too early", score: 0 },
]

type Step = {
  id: number
  title: string
  shortTitle: string
  description: string
}

const STEPS: Step[] = [
  { id: 1, title: "Professional Background", shortTitle: "Background", description: "Your experience and career history" },
  { id: 2, title: "M&A\nExperience", shortTitle: "M&A", description: "Mergers and acquisitions background" },
  { id: 3, title: "Acquisition Journey", shortTitle: "Journey", description: "Current stage and targets" },
  { id: 4, title: "Financial & Network", shortTitle: "Financial", description: "Investment capacity and affiliations" },
]

export default function QuestionnairePage() {
  const router = useRouter()
  const params = useParams()
  const repreneurId = params.id as string

  const [currentStep, setCurrentStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [repreneurName, setRepreneurName] = useState("")

  const [formData, setFormData] = useState<QuestionnaireInput>({
    q1_employment_status: null,
    q2_years_experience: null,
    q3_industry_sectors: [],
    q4_has_ma_experience: null,
    q5_team_size: null,
    q6_involved_in_ma: null,
    q7_ma_details: null,
    q8_executive_roles: [],
    q9_board_experience: null,
    q10_journey_stages: [],
    q11_target_sectors: [],
    q12_has_identified_targets: null,
    q13_target_details: null,
    q14_investment_capacity: null,
    q15_funding_status: null,
    q16_network_training: [],
    q17_open_to_co_acquisition: null,
  })

  // Load existing data
  useEffect(() => {
    async function loadData() {
      const res = await fetch(`/api/repreneurs/${repreneurId}`)
      if (res.ok) {
        const data = await res.json()
        setRepreneurName(`${data.first_name} ${data.last_name}`)
        setFormData({
          q1_employment_status: data.q1_employment_status ?? null,
          q2_years_experience: data.q2_years_experience ?? null,
          q3_industry_sectors: data.q3_industry_sectors ?? [],
          q4_has_ma_experience: data.q4_has_ma_experience,
          q5_team_size: data.q5_team_size ?? null,
          q6_involved_in_ma: data.q6_involved_in_ma,
          q7_ma_details: data.q7_ma_details ?? null,
          q8_executive_roles: data.q8_executive_roles ?? [],
          q9_board_experience: data.q9_board_experience,
          q10_journey_stages: data.q10_journey_stages ?? [],
          q11_target_sectors: data.q11_target_sectors ?? [],
          q12_has_identified_targets: data.q12_has_identified_targets,
          q13_target_details: data.q13_target_details ?? null,
          q14_investment_capacity: data.q14_investment_capacity ?? null,
          q15_funding_status: data.q15_funding_status ?? null,
          q16_network_training: data.q16_network_training ?? [],
          q17_open_to_co_acquisition: data.q17_open_to_co_acquisition,
        })
      }
    }
    loadData()
  }, [repreneurId])

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      await saveQuestionnaire(repreneurId, formData)
      router.push(`/repreneurs/${repreneurId}`)
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

  const setYesNo = (field: keyof QuestionnaireInput, value: boolean | null) => {
    setFormData({ ...formData, [field]: value })
  }

  // Check if all required questions are answered
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.q1_employment_status &&
          formData.q2_years_experience &&
          formData.q3_industry_sectors.length > 0 &&
          formData.q5_team_size &&
          formData.q8_executive_roles.length > 0
        )
      case 2:
        return !!(
          formData.q4_has_ma_experience !== null &&
          formData.q6_involved_in_ma !== null &&
          formData.q9_board_experience !== null
        )
      case 3:
        return !!(
          formData.q10_journey_stages.length > 0 &&
          formData.q11_target_sectors.length > 0 &&
          formData.q12_has_identified_targets !== null
        )
      case 4:
        return !!(
          formData.q14_investment_capacity &&
          formData.q15_funding_status &&
          formData.q16_network_training.length > 0 &&
          formData.q17_open_to_co_acquisition !== null
        )
      default:
        return false
    }
  }

  const isAllComplete = STEPS.every((step) => isStepComplete(step.id))

  // Calculate per-step progress percentage
  const getStepProgress = (step: number): number => {
    switch (step) {
      case 1: {
        let answered = 0
        if (formData.q1_employment_status) answered++
        if (formData.q2_years_experience) answered++
        if (formData.q3_industry_sectors.length > 0) answered++
        if (formData.q5_team_size) answered++
        if (formData.q8_executive_roles.length > 0) answered++
        return (answered / 5) * 100
      }
      case 2: {
        let answered = 0
        if (formData.q4_has_ma_experience !== null) answered++
        if (formData.q6_involved_in_ma !== null) answered++
        if (formData.q9_board_experience !== null) answered++
        return (answered / 3) * 100
      }
      case 3: {
        let answered = 0
        if (formData.q10_journey_stages.length > 0) answered++
        if (formData.q11_target_sectors.length > 0) answered++
        if (formData.q12_has_identified_targets !== null) answered++
        return (answered / 3) * 100
      }
      case 4: {
        let answered = 0
        if (formData.q14_investment_capacity) answered++
        if (formData.q15_funding_status) answered++
        if (formData.q16_network_training.length > 0) answered++
        if (formData.q17_open_to_co_acquisition !== null) answered++
        return (answered / 4) * 100
      }
      default:
        return 0
    }
  }

  const YesNoSkipQuestion = ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: boolean | null
    onChange: (val: boolean | null) => void
  }) => (
    <div className="space-y-3">
      <Label className="text-base font-medium">{label}</Label>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={value === true ? "default" : "outline"}
          className={`flex-1 min-w-[100px] ${value === true ? "bg-primary" : ""}`}
          onClick={() => onChange(true)}
        >
          <Check className="h-4 w-4 mr-2" />
          Yes
        </Button>
        <Button
          type="button"
          variant={value === false ? "default" : "outline"}
          className={`flex-1 min-w-[100px] ${value === false ? "bg-primary" : ""}`}
          onClick={() => onChange(false)}
        >
          <X className="h-4 w-4 mr-2" />
          No
        </Button>
        <Button
          type="button"
          variant={value === null ? "secondary" : "ghost"}
          className="flex-1 min-w-[100px] text-muted-foreground"
          onClick={() => onChange(null)}
        >
          Skip
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Unified Header */}
      <div className="bg-white border-b shadow-sm shrink-0">
        {/* Top row: Back button and title */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="max-w-4xl mx-auto flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/repreneurs/${repreneurId}`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Profile</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="text-center flex-1 px-4">
              <h1 className="font-semibold text-gray-900">Intake Questionnaire</h1>
              <p className="text-xs text-muted-foreground">{repreneurName}</p>
            </div>
            <div className="w-[100px]" /> {/* Spacer for centering */}
          </div>
        </div>

        {/* Step cards with integrated progress */}
        <div className="px-4 py-3">
          <div className="max-w-xl mx-auto">
            <div className="grid grid-cols-4 gap-2">
              {STEPS.map((step) => {
                const complete = isStepComplete(step.id)
                const active = currentStep === step.id
                const progress = getStepProgress(step.id)
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    className={`
                      relative overflow-hidden rounded-lg border-2 text-left transition-all min-h-[60px] flex flex-col
                      ${active
                        ? "border-primary ring-2 ring-primary/20"
                        : complete
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }
                    `}
                  >
                    {/* Card content */}
                    <div className="px-2 py-2 flex-1">
                      <div className="flex items-start gap-1.5">
                        {complete && (
                          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                        <span className={`text-xs font-medium leading-tight whitespace-pre-line ${complete ? "text-green-700" : active ? "text-primary" : "text-gray-700"}`}>
                          {step.id}. {step.title}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar at bottom */}
                    {!complete && (
                      <div className="h-1 bg-gray-100 mt-auto">
                        <div
                          className={`h-full transition-all duration-300 ${active ? "bg-primary" : "bg-gray-300"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    {/* Full green bar when complete */}
                    {complete && (
                      <div className="h-1 bg-green-500 mt-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{STEPS[currentStep - 1].title}</CardTitle>
              <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-10">
              {/* Step 1: Professional Background */}
              {currentStep === 1 && (
                <>
                  {/* Q1: Employment Status */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q1. Current employment status</Label>
                    <RadioGroup
                      value={formData.q1_employment_status ?? ""}
                      onValueChange={(v) => setFormData({ ...formData, q1_employment_status: v })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {EMPLOYMENT_STATUS_WITH_SKIP.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q1_employment_status === opt.value ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <RadioGroupItem value={opt.value} id={`q1-${opt.value}`} />
                          <Label htmlFor={`q1-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Q2: Years of Experience */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q2. Years of professional experience</Label>
                    <RadioGroup
                      value={formData.q2_years_experience ?? ""}
                      onValueChange={(v) => setFormData({ ...formData, q2_years_experience: v })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {YEARS_EXPERIENCE_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q2_years_experience === opt.value ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <RadioGroupItem value={opt.value} id={`q2-${opt.value}`} />
                          <Label htmlFor={`q2-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Q3: Industry Sectors */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q3. Industry sectors of experience (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {INDUSTRY_SECTOR_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q3_industry_sectors.includes(opt.value) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <Checkbox
                            id={`q3-${opt.value}`}
                            checked={formData.q3_industry_sectors.includes(opt.value)}
                            onCheckedChange={() => toggleMultiSelect("q3_industry_sectors", opt.value)}
                          />
                          <Label htmlFor={`q3-${opt.value}`} className="flex-1 cursor-pointer text-sm">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Q4: Team Size */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q4. Largest team size managed</Label>
                    <RadioGroup
                      value={formData.q5_team_size ?? ""}
                      onValueChange={(v) => setFormData({ ...formData, q5_team_size: v })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {TEAM_SIZE_WITH_SKIP.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q5_team_size === opt.value ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <RadioGroupItem value={opt.value} id={`q4-${opt.value}`} />
                          <Label htmlFor={`q4-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Q5: Executive Roles */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q5. Executive roles held (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EXECUTIVE_ROLE_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q8_executive_roles.includes(opt.value) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <Checkbox
                            id={`q5-${opt.value}`}
                            checked={formData.q8_executive_roles.includes(opt.value)}
                            onCheckedChange={() => toggleMultiSelect("q8_executive_roles", opt.value)}
                          />
                          <Label htmlFor={`q5-${opt.value}`} className="flex-1 cursor-pointer text-sm">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: M&A Experience */}
              {currentStep === 2 && (
                <>
                  <YesNoSkipQuestion
                    label="Q6. Do you have M&A experience?"
                    value={formData.q4_has_ma_experience}
                    onChange={(v) => setYesNo("q4_has_ma_experience", v)}
                  />

                  <YesNoSkipQuestion
                    label="Q7. Have you been directly involved in M&A transactions?"
                    value={formData.q6_involved_in_ma}
                    onChange={(v) => setYesNo("q6_involved_in_ma", v)}
                  />

                  {(formData.q4_has_ma_experience || formData.q6_involved_in_ma) && (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Q8. Describe your M&A experience (optional)</Label>
                      <Textarea
                        value={formData.q7_ma_details ?? ""}
                        onChange={(e) => setFormData({ ...formData, q7_ma_details: e.target.value })}
                        placeholder="Describe your experience with acquisitions, sales, or other M&A transactions..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                  )}

                  <YesNoSkipQuestion
                    label="Q9. Do you have board or advisory experience?"
                    value={formData.q9_board_experience}
                    onChange={(v) => setYesNo("q9_board_experience", v)}
                  />
                </>
              )}

              {/* Step 3: Acquisition Journey */}
              {currentStep === 3 && (
                <>
                  {/* Q10: Journey Stages */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q10. Current journey stage (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {JOURNEY_STAGE_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q10_journey_stages.includes(opt.value) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <Checkbox
                            id={`q10-${opt.value}`}
                            checked={formData.q10_journey_stages.includes(opt.value)}
                            onCheckedChange={() => toggleMultiSelect("q10_journey_stages", opt.value)}
                          />
                          <Label htmlFor={`q10-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Q11: Target Sectors */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q11. Target acquisition sectors (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {INDUSTRY_SECTOR_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q11_target_sectors.includes(opt.value) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <Checkbox
                            id={`q11-${opt.value}`}
                            checked={formData.q11_target_sectors.includes(opt.value)}
                            onCheckedChange={() => toggleMultiSelect("q11_target_sectors", opt.value)}
                          />
                          <Label htmlFor={`q11-${opt.value}`} className="flex-1 cursor-pointer text-sm">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <YesNoSkipQuestion
                    label="Q12. Have you identified specific acquisition targets?"
                    value={formData.q12_has_identified_targets}
                    onChange={(v) => setYesNo("q12_has_identified_targets", v)}
                  />

                  {formData.q12_has_identified_targets && (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Q13. Describe your identified targets (optional)</Label>
                      <Textarea
                        value={formData.q13_target_details ?? ""}
                        onChange={(e) => setFormData({ ...formData, q13_target_details: e.target.value })}
                        placeholder="CA, number of employees, valuation range, sector..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Step 4: Financial & Network */}
              {currentStep === 4 && (
                <>
                  {/* Q14: Investment Capacity */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q14. Investment capacity</Label>
                    <RadioGroup
                      value={formData.q14_investment_capacity ?? ""}
                      onValueChange={(v) => setFormData({ ...formData, q14_investment_capacity: v })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {INVESTMENT_CAPACITY_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q14_investment_capacity === opt.value ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <RadioGroupItem value={opt.value} id={`q14-${opt.value}`} />
                          <Label htmlFor={`q14-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Q15: Funding Status */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q15. Funding status</Label>
                    <RadioGroup
                      value={formData.q15_funding_status ?? ""}
                      onValueChange={(v) => setFormData({ ...formData, q15_funding_status: v })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {FUNDING_STATUS_WITH_SKIP.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q15_funding_status === opt.value ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <RadioGroupItem value={opt.value} id={`q15-${opt.value}`} />
                          <Label htmlFor={`q15-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Q16: Network/Training */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Q16. Network or training affiliations (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {NETWORK_TRAINING_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.q16_network_training.includes(opt.value) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}>
                          <Checkbox
                            id={`q16-${opt.value}`}
                            checked={formData.q16_network_training.includes(opt.value)}
                            onCheckedChange={() => toggleMultiSelect("q16_network_training", opt.value)}
                          />
                          <Label htmlFor={`q16-${opt.value}`} className="flex-1 cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <YesNoSkipQuestion
                    label="Q17. Open to co-acquisition?"
                    value={formData.q17_open_to_co_acquisition}
                    onChange={(v) => setYesNo("q17_open_to_co_acquisition", v)}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Navigation Footer */}
          <div className="flex items-center justify-between mt-6 pb-8">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-3">
              {currentStep < STEPS.length ? (
                <Button onClick={() => setCurrentStep(currentStep + 1)}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isAllComplete || isSaving}
                  className="min-w-[180px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate Score
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Incomplete warning */}
          {currentStep === STEPS.length && !isAllComplete && (
            <div className="text-center text-sm text-amber-600 bg-amber-50 rounded-lg p-4 mb-8">
              Please complete all sections before calculating the score.
              {STEPS.filter((step) => !isStepComplete(step.id)).map((step) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className="block mx-auto mt-2 underline hover:no-underline"
                >
                  → Complete {step.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
