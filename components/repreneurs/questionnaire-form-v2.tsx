"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, FileText, Calculator, Check, AlertTriangle, History, User, Briefcase, Target, Wallet } from "lucide-react"
import { saveQuestionnaireV2 } from "@/lib/actions/repreneurs"
import { calculateDualScore } from "@/lib/utils/scoring-v2"
import { WHO_QUESTIONS, PROJECT_STATUS_QUESTION, WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import { FlagBadges } from "@/components/scoring-v2/flag-badges"
import { RecommendationBadge } from "@/components/scoring-v2/recommendation-badge"
import type { Repreneur } from "@/lib/types/repreneur"
import type { WhoAnswers, WhenAnswers, DualScoreResult, RecommendedAction } from "@/lib/types/scoring-v2"

interface QuestionnaireFormV2Props {
  repreneur: Repreneur
}

// Form data state type
interface V2FormData {
  // WHO (Q05-Q10)
  q05_status: string | null
  q06_experience: string | null
  q07_leadership: string | null
  q08_crisis: string | null
  q09_investment: string | null
  q10_impact: string | null
  // WHEN (Q11-Q16)
  q11_project_status: string[]
  q12_geo_zones: string[]
  q13_target_sectors_v2: string[]
  q14_deal_size: string[]
  q15_structure: string[]
  q16_equity: string | null
}

export function QuestionnaireFormV2({ repreneur }: QuestionnaireFormV2Props) {
  const [isExpanded, setIsExpanded] = useState(!repreneur.questionnaire_completed_at)
  const [showLegacy, setShowLegacy] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state initialized from repreneur data
  const [formData, setFormData] = useState<V2FormData>({
    // WHO
    q05_status: repreneur.q05_status ?? null,
    q06_experience: repreneur.q06_experience ?? null,
    q07_leadership: repreneur.q07_leadership ?? null,
    q08_crisis: repreneur.q08_crisis ?? null,
    q09_investment: repreneur.q09_investment ?? null,
    q10_impact: repreneur.q10_impact ?? null,
    // WHEN
    q11_project_status: repreneur.q11_project_status ?? [],
    q12_geo_zones: repreneur.q12_geo_zones ?? [],
    q13_target_sectors_v2: repreneur.q13_target_sectors_v2 ?? [],
    q14_deal_size: repreneur.q14_deal_size ?? [],
    q15_structure: repreneur.q15_structure ?? [],
    q16_equity: repreneur.q16_equity ?? null,
  })

  // Calculate preview scores in real-time
  const previewScore: DualScoreResult | null = useMemo(() => {
    // Check if we have enough data to calculate
    const hasWhoData = formData.q05_status && formData.q06_experience && formData.q07_leadership &&
                       formData.q08_crisis && formData.q09_investment && formData.q10_impact
    const hasWhenData = formData.q11_project_status.length > 0 && formData.q14_deal_size.length > 0 &&
                        formData.q15_structure.length > 0 && formData.q16_equity

    if (!hasWhoData || !hasWhenData) return null

    const whoAnswers: WhoAnswers = {
      q05: formData.q05_status as WhoAnswers['q05'],
      q06: formData.q06_experience as WhoAnswers['q06'],
      q07: formData.q07_leadership as WhoAnswers['q07'],
      q08: formData.q08_crisis as WhoAnswers['q08'],
      q09: formData.q09_investment as WhoAnswers['q09'],
      q10: formData.q10_impact as WhoAnswers['q10'],
    }

    const whenAnswers: WhenAnswers = {
      q11: formData.q11_project_status as WhenAnswers['q11'],
      q12: formData.q12_geo_zones,
      q13: formData.q13_target_sectors_v2,
      q14: formData.q14_deal_size as WhenAnswers['q14'],
      q15: formData.q15_structure as WhenAnswers['q15'],
      q16: formData.q16_equity as WhenAnswers['q16'],
    }

    return calculateDualScore(whoAnswers, whenAnswers)
  }, [formData])

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      await saveQuestionnaireV2(repreneur.id, formData)
      setIsExpanded(false)
    } catch (error) {
      console.error("Failed to save questionnaire:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Helper to toggle multi-select values
  const toggleArrayValue = (field: keyof V2FormData, value: string) => {
    const current = formData[field] as string[]
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    setFormData(prev => ({ ...prev, [field]: updated }))
  }

  const hasV2Data = repreneur.who_score !== null && repreneur.who_score !== undefined
  const hasLegacyData = repreneur.tier1_score !== null && repreneur.tier1_score !== undefined

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="size-5" />
            <div>
              <CardTitle>Questionnaire (Dual Scoring v2)</CardTitle>
              <CardDescription>
                {hasV2Data
                  ? `WHO: ${repreneur.who_score}/100 | WHEN: ${repreneur.when_score}/100`
                  : hasLegacyData
                    ? `Legacy Tier 1: ${repreneur.tier1_score} pts (needs v2 completion)`
                    : "Questionnaire not completed"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasV2Data && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Check className="size-3 mr-1" />
                v2 Complete
              </Badge>
            )}
            {!hasV2Data && hasLegacyData && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                <AlertTriangle className="size-3 mr-1" />
                Needs Upgrade
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="size-5 text-gray-400" />
            ) : (
              <ChevronDown className="size-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-8">
          {/* Score Preview Panel */}
          {previewScore && (
            <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calculator className="size-4" />
                Score Preview (live)
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">WHO:</span>
                  <span className={`font-bold ${previewScore.who.score >= 70 ? 'text-green-600' : previewScore.who.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {previewScore.who.score}/100
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">WHEN:</span>
                  <span className={`font-bold ${previewScore.when.score >= 80 ? 'text-green-600' : previewScore.when.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {previewScore.when.score}/100
                  </span>
                </div>
                <RecommendationBadge recommendation={previewScore.recommendation} size="sm" />
                {previewScore.flags.flags.length > 0 && (
                  <FlagBadges flags={previewScore.flags.flags} compact />
                )}
              </div>
            </div>
          )}

          {/* WHO Section (Q05-Q10) */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <User className="size-5 text-primary" />
              <h3 className="font-semibold">Profil (WHO Score)</h3>
            </div>

            {/* Q05 - Status */}
            <div className="space-y-2">
              <Label>{WHO_QUESTIONS.q05.label}</Label>
              <RadioGroup
                value={formData.q05_status ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q05_status: value }))}
              >
                <div className="grid gap-2">
                  {WHO_QUESTIONS.q05.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q05-${option.value}`} />
                      <Label htmlFor={`q05-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Q06 - Experience */}
            <div className="space-y-2">
              <Label>{WHO_QUESTIONS.q06.label}</Label>
              <RadioGroup
                value={formData.q06_experience ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q06_experience: value }))}
              >
                <div className="grid gap-2">
                  {WHO_QUESTIONS.q06.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q06-${option.value}`} />
                      <Label htmlFor={`q06-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Q07 - Leadership */}
            <div className="space-y-2">
              <Label>{WHO_QUESTIONS.q07.label}</Label>
              <RadioGroup
                value={formData.q07_leadership ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q07_leadership: value }))}
              >
                <div className="grid gap-2">
                  {WHO_QUESTIONS.q07.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q07-${option.value}`} />
                      <Label htmlFor={`q07-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Q08 - Crisis */}
            <div className="space-y-2">
              <Label>{WHO_QUESTIONS.q08.label}</Label>
              <RadioGroup
                value={formData.q08_crisis ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q08_crisis: value }))}
              >
                <div className="grid gap-2">
                  {WHO_QUESTIONS.q08.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q08-${option.value}`} />
                      <Label htmlFor={`q08-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Q09 - Investment */}
            <div className="space-y-2">
              <Label>{WHO_QUESTIONS.q09.label}</Label>
              <RadioGroup
                value={formData.q09_investment ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q09_investment: value }))}
              >
                <div className="grid gap-2">
                  {WHO_QUESTIONS.q09.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q09-${option.value}`} />
                      <Label htmlFor={`q09-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Q10 - Impact */}
            <div className="space-y-2">
              <Label>{WHO_QUESTIONS.q10.label}</Label>
              <RadioGroup
                value={formData.q10_impact ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q10_impact: value }))}
              >
                <div className="grid gap-2">
                  {WHO_QUESTIONS.q10.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q10-${option.value}`} />
                      <Label htmlFor={`q10-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </section>

          {/* Project Status Section (Q11) */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Target className="size-5 text-primary" />
              <h3 className="font-semibold">Projet (WHEN Score)</h3>
            </div>

            {/* Q11 - Project Status */}
            <div className="space-y-2">
              <Label>{PROJECT_STATUS_QUESTION.q11.label}</Label>
              <p className="text-sm text-muted-foreground">{PROJECT_STATUS_QUESTION.q11.helpText}</p>
              <div className="grid gap-2">
                {PROJECT_STATUS_QUESTION.q11.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q11-${option.value}`}
                      checked={formData.q11_project_status.includes(option.value)}
                      onCheckedChange={() => toggleArrayValue('q11_project_status', option.value)}
                    />
                    <Label htmlFor={`q11-${option.value}`} className="font-normal cursor-pointer">
                      {option.label}
                      <span className="text-xs text-muted-foreground ml-2">({option.points} pts)</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* WHEN Section (Q12-Q16) */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Wallet className="size-5 text-primary" />
              <h3 className="font-semibold">Critères de Recherche</h3>
            </div>

            {/* Q12 - Geographic Zones */}
            <div className="space-y-2">
              <Label>{WHEN_QUESTIONS.q12.label}</Label>
              <div className="grid grid-cols-2 gap-2">
                {WHEN_QUESTIONS.q12.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q12-${option.value}`}
                      checked={formData.q12_geo_zones.includes(option.value)}
                      onCheckedChange={() => toggleArrayValue('q12_geo_zones', option.value)}
                    />
                    <Label htmlFor={`q12-${option.value}`} className="font-normal cursor-pointer text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q13 - Target Sectors */}
            <div className="space-y-2">
              <Label>{WHEN_QUESTIONS.q13.label}</Label>
              <div className="grid grid-cols-2 gap-2">
                {WHEN_QUESTIONS.q13.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q13-${option.value}`}
                      checked={formData.q13_target_sectors_v2.includes(option.value)}
                      onCheckedChange={() => toggleArrayValue('q13_target_sectors_v2', option.value)}
                    />
                    <Label htmlFor={`q13-${option.value}`} className="font-normal cursor-pointer text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q14 - Deal Size */}
            <div className="space-y-2">
              <Label>{WHEN_QUESTIONS.q14.label}</Label>
              <p className="text-sm text-muted-foreground">{WHEN_QUESTIONS.q14.helpText}</p>
              <div className="grid gap-2">
                {WHEN_QUESTIONS.q14.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q14-${option.value}`}
                      checked={formData.q14_deal_size.includes(option.value)}
                      onCheckedChange={() => toggleArrayValue('q14_deal_size', option.value)}
                    />
                    <Label htmlFor={`q14-${option.value}`} className="font-normal cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q15 - Capital Structure */}
            <div className="space-y-2">
              <Label>{WHEN_QUESTIONS.q15.label}</Label>
              <p className="text-sm text-muted-foreground">{WHEN_QUESTIONS.q15.helpText}</p>
              <div className="grid gap-2">
                {WHEN_QUESTIONS.q15.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q15-${option.value}`}
                      checked={formData.q15_structure.includes(option.value)}
                      onCheckedChange={() => toggleArrayValue('q15_structure', option.value)}
                    />
                    <Label htmlFor={`q15-${option.value}`} className="font-normal cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Q16 - Equity Contribution */}
            <div className="space-y-2">
              <Label>{WHEN_QUESTIONS.q16.label}</Label>
              <RadioGroup
                value={formData.q16_equity ?? ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, q16_equity: value }))}
              >
                <div className="grid gap-2">
                  {WHEN_QUESTIONS.q16.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`q16-${option.value}`} />
                      <Label htmlFor={`q16-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </section>

          {/* Legacy Data Section (Q1-Q17) - Read-only */}
          {hasLegacyData && (
            <Collapsible open={showLegacy} onOpenChange={setShowLegacy}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <History className="size-4" />
                    <span>Legacy Questionnaire Data (v1)</span>
                    <Badge variant="secondary">{repreneur.tier1_score} pts</Badge>
                  </div>
                  {showLegacy ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="bg-muted/30 rounded-lg p-4 space-y-4 text-sm">
                  <p className="text-muted-foreground italic">
                    Ces données proviennent de l&apos;ancien questionnaire et sont en lecture seule.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Statut:</span>{" "}
                      <span className="text-muted-foreground">{repreneur.q1_employment_status || "-"}</span>
                    </div>
                    <div>
                      <span className="font-medium">Expérience:</span>{" "}
                      <span className="text-muted-foreground">{repreneur.q2_years_experience || "-"}</span>
                    </div>
                    <div>
                      <span className="font-medium">Taille équipe:</span>{" "}
                      <span className="text-muted-foreground">{repreneur.q5_team_size || "-"}</span>
                    </div>
                    <div>
                      <span className="font-medium">Exp. M&A:</span>{" "}
                      <span className="text-muted-foreground">{repreneur.q4_has_ma_experience ? "Oui" : "Non"}</span>
                    </div>
                    <div>
                      <span className="font-medium">Capacité investissement:</span>{" "}
                      <span className="text-muted-foreground">{repreneur.q14_investment_capacity || "-"}</span>
                    </div>
                    <div>
                      <span className="font-medium">Financement:</span>{" "}
                      <span className="text-muted-foreground">{repreneur.q15_funding_status || "-"}</span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSubmit} disabled={isSaving}>
              <Calculator className="size-4 mr-2" />
              {isSaving ? "Calcul en cours..." : "Calculer Score & Sauvegarder"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
