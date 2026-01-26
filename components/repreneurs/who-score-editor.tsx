"use client"

import { useState, useTransition } from "react"
import { Calculator, Loader2, Pencil } from "lucide-react"
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
import { toast } from "sonner"
import { saveQuestionnaireV2 } from "@/lib/actions/repreneurs"
import { calculateWhoScore } from "@/lib/utils/scoring-v2"
import { WHO_QUESTIONS } from "@/lib/config/questionnaire-v2"
import type { Repreneur } from "@/lib/types/repreneur"
import type { WhoAnswers } from "@/lib/types/scoring-v2"

interface WhoScoreEditorProps {
  repreneur: Repreneur
  onSaved?: () => void
}

export function WhoScoreEditor({ repreneur, onSaved }: WhoScoreEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Initialize local state with current repreneur values
  const getInitialAnswers = (): WhoAnswers => {
    return {
      q05: (repreneur as any).q05_status || 'employee',
      q06: (repreneur as any).q06_experience || 'less_than_10',
      q07: (repreneur as any).q07_leadership || 'none',
      q08: (repreneur as any).q08_crisis || 'none',
      q09: (repreneur as any).q09_investment || 'none',
      q10: (repreneur as any).q10_impact || 'none',
    }
  }

  const [localAnswers, setLocalAnswers] = useState<WhoAnswers>(getInitialAnswers)

  // Calculate live score preview
  const liveScore = calculateWhoScore(localAnswers)

  // Reset local state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalAnswers(getInitialAnswers())
    }
    setIsOpen(open)
  }

  // Update local state only (no server call)
  const handleLocalChange = (field: keyof WhoAnswers, value: string) => {
    setLocalAnswers(prev => ({ ...prev, [field]: value as any }))
  }

  // Save all changes and recalculate score
  const handleCalculate = async () => {
    startTransition(async () => {
      try {
        // Build complete questionnaire input (preserve existing WHEN answers)
        const input = {
          // WHO answers (updated)
          q05_status: localAnswers.q05,
          q06_experience: localAnswers.q06,
          q07_leadership: localAnswers.q07,
          q08_crisis: localAnswers.q08,
          q09_investment: localAnswers.q09,
          q10_impact: localAnswers.q10,
          // WHEN answers (preserve existing)
          q11_project_status: (repreneur as any).q11_project_status || [],
          q12_geo_zones: (repreneur as any).q12_geo_zones || [],
          q13_target_sectors_v2: (repreneur as any).q13_target_sectors_v2 || [],
          q14_deal_size: (repreneur as any).q14_deal_size || [],
          q15_structure: (repreneur as any).q15_structure || [],
          q16_equity: (repreneur as any).q16_equity || null,
        }

        await saveQuestionnaireV2(repreneur.id, input)
        toast.success("WHO score updated")
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
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit WHO Score</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Q05 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHO_QUESTIONS.q05.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q05}
              onValueChange={(v) => handleLocalChange('q05', v)}
            >
              {WHO_QUESTIONS.q05.options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`q05-${opt.value}`} />
                  <Label htmlFor={`q05-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q06 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHO_QUESTIONS.q06.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q06}
              onValueChange={(v) => handleLocalChange('q06', v)}
            >
              {WHO_QUESTIONS.q06.options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`q06-${opt.value}`} />
                  <Label htmlFor={`q06-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q07 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHO_QUESTIONS.q07.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q07}
              onValueChange={(v) => handleLocalChange('q07', v)}
            >
              {WHO_QUESTIONS.q07.options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`q07-${opt.value}`} />
                  <Label htmlFor={`q07-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q08 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHO_QUESTIONS.q08.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q08}
              onValueChange={(v) => handleLocalChange('q08', v)}
            >
              {WHO_QUESTIONS.q08.options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`q08-${opt.value}`} />
                  <Label htmlFor={`q08-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q09 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHO_QUESTIONS.q09.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q09}
              onValueChange={(v) => handleLocalChange('q09', v)}
            >
              {WHO_QUESTIONS.q09.options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`q09-${opt.value}`} />
                  <Label htmlFor={`q09-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q10 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {WHO_QUESTIONS.q10.labelEn}
            </Label>
            <RadioGroup
              value={localAnswers.q10}
              onValueChange={(v) => handleLocalChange('q10', v)}
            >
              {WHO_QUESTIONS.q10.options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`q10-${opt.value}`} />
                  <Label htmlFor={`q10-${opt.value}`} className="text-xs font-normal cursor-pointer">
                    {opt.label} ({opt.points} pts)
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Live Score Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-700">Live Score Preview</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{liveScore.score}</span>
                <span className="text-sm text-gray-500">/ 100</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium">{liveScore.breakdown.q05} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Experience:</span>
                <span className="font-medium">{liveScore.breakdown.q06} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Leadership:</span>
                <span className="font-medium">{liveScore.breakdown.q07} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Crisis:</span>
                <span className="font-medium">{liveScore.breakdown.q08} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Investment:</span>
                <span className="font-medium">{liveScore.breakdown.q09} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Impact:</span>
                <span className="font-medium">{liveScore.breakdown.q10} pts</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="pt-4 border-t">
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
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            {isPending ? "Saving..." : "Calculate & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
