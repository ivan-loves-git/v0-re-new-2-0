"use client"

import { useState, useTransition } from "react"
import { Calculator, Loader2, Pencil, AlertTriangle, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { saveQuestionnaireV2 } from "@/lib/actions/repreneurs"
import { calculateWhenScore, detectFlags, FLAG_DESCRIPTIONS } from "@/lib/utils/scoring-v2"
import { PROJECT_STATUS_QUESTION, WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import type { Repreneur } from "@/lib/types/repreneur"
import type { WhenAnswers, Q11ProjectStatus, Q14DealSize, Q15Structure, Q16Equity } from "@/lib/types/scoring-v2"

interface WhenScoreEditorProps {
  repreneur: Repreneur
  onSaved?: () => void
}

export function WhenScoreEditor({ repreneur, onSaved }: WhenScoreEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Initialize local state with current repreneur values
  const getInitialAnswers = (): WhenAnswers => {
    return {
      q11: (repreneur as any).q11_project_status || [],
      q12: (repreneur as any).q12_geo_zones || [],
      q13: (repreneur as any).q13_target_sectors_v2 || [],
      q14: (repreneur as any).q14_deal_size || [],
      q15: (repreneur as any).q15_structure || [],
      q16: (repreneur as any).q16_equity || 'tbd',
      // v3 penalty inputs — read from DB, read-only in this editor
      q11_priority: (repreneur as any).q11_priority_choice || null,
      hasFicheDeCadrage: Boolean((repreneur as any).ldc_url),
    }
  }

  const [localAnswers, setLocalAnswers] = useState<WhenAnswers>(getInitialAnswers)

  // Calculate live score preview and flags
  const liveScore = calculateWhenScore(localAnswers)
  const flagResult = detectFlags(localAnswers)

  // Reset local state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalAnswers(getInitialAnswers())
    }
    setIsOpen(open)
  }

  // Update checkbox arrays
  const handleCheckboxChange = (field: 'q11' | 'q12' | 'q13' | 'q14' | 'q15', value: string, checked: boolean) => {
    setLocalAnswers(prev => {
      const currentArray = prev[field] as string[]
      const newArray = checked
        ? [...currentArray, value]
        : currentArray.filter(v => v !== value)
      return { ...prev, [field]: newArray }
    })
  }

  // Update radio (single select)
  const handleRadioChange = (field: 'q16', value: string) => {
    setLocalAnswers(prev => ({ ...prev, [field]: value as Q16Equity }))
  }

  // Save all changes and recalculate score
  const handleCalculate = async () => {
    startTransition(async () => {
      try {
        // Build complete questionnaire input (preserve existing WHO answers)
        const input = {
          // WHO answers (preserve existing)
          q05_status: (repreneur as any).q05_status || null,
          q06_experience: (repreneur as any).q06_experience || null,
          q07_leadership: (repreneur as any).q07_leadership || null,
          q08_crisis: (repreneur as any).q08_crisis || null,
          q09_investment: (repreneur as any).q09_investment || null,
          q10_impact: (repreneur as any).q10_impact || null,
          // WHEN answers (updated)
          q11_project_status: localAnswers.q11,
          q12_geo_zones: localAnswers.q12,
          q13_target_sectors_v2: localAnswers.q13,
          q14_deal_size: localAnswers.q14,
          q15_structure: localAnswers.q15,
          q16_equity: localAnswers.q16,
        }

        await saveQuestionnaireV2(repreneur.id, input)
        toast.success("WHEN score updated")
        setIsOpen(false)
        onSaved?.()
      } catch (error) {
        toast.error("Failed to update score")
        console.error(error)
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Edit WHEN score"
        >
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit WHEN score</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto pr-2">
          {/* Q11 v3 priority choice — read-only context for the score */}
          {localAnswers.q11_priority && (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Acquisition priority (Q11)
              </Label>
              <p className="text-sm text-foreground">
                {localAnswers.q11_priority === 'preferred'
                  ? 'Preferred career option'
                  : "One option among others"}
                {localAnswers.q11_priority === 'one_among_others' && (
                  <span className="ml-2 text-xs font-medium text-destructive">−10 WHEN penalty</span>
                )}
              </p>
            </div>
          )}

          {/* Fiche de cadrage status — flag the missing-fiche penalty */}
          {localAnswers.q11_priority && localAnswers.q11.includes('framed') && !localAnswers.hasFicheDeCadrage && (
            <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning/5 p-3 text-sm text-foreground">
              <FileWarning className="size-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">Projet cadré without fiche de cadrage</span>
                <span className="ml-2 text-xs font-medium text-destructive">−10 WHEN penalty</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  The candidate selected &quot;Projet cadré&quot; in Q12 but no lettre de cadrage was uploaded.
                </p>
              </div>
            </div>
          )}

          {/* Q11 - Project Status (multi-select) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {PROJECT_STATUS_QUESTION.q11.labelEn}
            </Label>
            <p className="text-xs text-muted-foreground">{PROJECT_STATUS_QUESTION.q11.helpTextEn}</p>
            <div className="space-y-2">
              {PROJECT_STATUS_QUESTION.q11.options.map((opt) => (
                <div key={opt.value} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`q11-${opt.value}`}
                    checked={localAnswers.q11.includes(opt.value as Q11ProjectStatus)}
                    onCheckedChange={(checked) => handleCheckboxChange('q11', opt.value, checked as boolean)}
                  />
                  <Label htmlFor={`q11-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Q12 - Geographic Zones (multi-select, no scoring) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHEN_QUESTIONS.q12.labelEn}
              <span className="ml-2 text-xs font-normal text-muted-foreground">(info only)</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {WHEN_QUESTIONS.q12.options.map((opt) => (
                <div key={opt.value} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`q12-${opt.value}`}
                    checked={localAnswers.q12.includes(opt.value)}
                    onCheckedChange={(checked) => handleCheckboxChange('q12', opt.value, checked as boolean)}
                  />
                  <Label htmlFor={`q12-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Q13 - Target Sectors (multi-select, no scoring) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHEN_QUESTIONS.q13.labelEn}
              <span className="ml-2 text-xs font-normal text-muted-foreground">(info only)</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {WHEN_QUESTIONS.q13.options.map((opt) => (
                <div key={opt.value} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`q13-${opt.value}`}
                    checked={localAnswers.q13.includes(opt.value)}
                    onCheckedChange={(checked) => handleCheckboxChange('q13', opt.value, checked as boolean)}
                  />
                  <Label htmlFor={`q13-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Q14 - Deal Size (multi-select) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHEN_QUESTIONS.q14.labelEn}
            </Label>
            <p className="text-xs text-muted-foreground">{WHEN_QUESTIONS.q14.helpTextEn}</p>
            <div className="space-y-2">
              {WHEN_QUESTIONS.q14.options.map((opt) => (
                <div key={opt.value} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`q14-${opt.value}`}
                    checked={localAnswers.q14.includes(opt.value as Q14DealSize)}
                    onCheckedChange={(checked) => handleCheckboxChange('q14', opt.value, checked as boolean)}
                  />
                  <Label htmlFor={`q14-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Q15 - Structure (multi-select) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHEN_QUESTIONS.q15.labelEn}
            </Label>
            <p className="text-xs text-muted-foreground">{WHEN_QUESTIONS.q15.helpTextEn}</p>
            <div className="space-y-2">
              {WHEN_QUESTIONS.q15.options.map((opt) => (
                <div key={opt.value} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`q15-${opt.value}`}
                    checked={localAnswers.q15.includes(opt.value as Q15Structure)}
                    onCheckedChange={(checked) => handleCheckboxChange('q15', opt.value, checked as boolean)}
                  />
                  <Label htmlFor={`q15-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Q16 - Equity (single select) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHEN_QUESTIONS.q16.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q16}
              onValueChange={(v) => handleRadioChange('q16', v)}
            >
              {WHEN_QUESTIONS.q16.options.map((opt) => (
                <div key={opt.value} className="flex min-h-8 items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`q16-${opt.value}`} />
                  <Label htmlFor={`q16-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Live Score Preview */}
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-foreground">Live score preview</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">{liveScore.score}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Financial Fit:</span>
                <span className="font-medium">{liveScore.breakdown.fitFinancier} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Clarity:</span>
                <span className="font-medium">{liveScore.breakdown.clarity} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Project Status:</span>
                <span className="font-medium">{liveScore.breakdown.projectStatus} pts</span>
              </div>
              {(liveScore.breakdown.penalties ?? 0) < 0 && (
                <div className="mt-1 flex justify-between border-t pt-1 text-destructive">
                  <span>v3 penalties:</span>
                  <span className="font-medium">{liveScore.breakdown.penalties} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Flags Display */}
          {flagResult.flags.length > 0 && (
            <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Warning flags</span>
              </div>
              <div className="space-y-2">
                {flagResult.flags.map((flag) => (
                  <div key={flag} className="flex items-start gap-2">
                    <Badge variant="destructive" className="text-xs">{flag}</Badge>
                    <span className="text-xs text-muted-foreground">{FLAG_DESCRIPTIONS[flag]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCalculate}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Calculator className="size-4" data-icon="inline-start" />
            )}
            {isPending ? "Saving..." : "Calculate & save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
