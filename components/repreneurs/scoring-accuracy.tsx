"use client"

import { useState, useTransition } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { SCORING_ACCURACY_OPTIONS } from "@/lib/types/repreneur"
import { saveAccuracyRating } from "@/lib/actions/repreneurs"
import { toast } from "sonner"
import { Check, Target } from "lucide-react"
import { formatDisplayDate } from "@/lib/utils/display-date-time"

interface ScoringAccuracyProps {
  repreneurId: string
  whoAccuracy?: string | null
  whenAccuracy?: string | null
  accuracyNotes?: string | null
  accuracyRatedAt?: string | null
}

export function ScoringAccuracy({
  repreneurId,
  whoAccuracy,
  whenAccuracy,
  accuracyNotes,
  accuracyRatedAt,
}: ScoringAccuracyProps) {
  const [who, setWho] = useState(whoAccuracy ?? "")
  const [when, setWhen] = useState(whenAccuracy ?? "")
  const [notes, setNotes] = useState(accuracyNotes ?? "")
  const [isPending, startTransition] = useTransition()

  const hasChanges =
    who !== (whoAccuracy ?? "") ||
    when !== (whenAccuracy ?? "") ||
    notes !== (accuracyNotes ?? "")

  const canSave = who && when && hasChanges

  function handleSave() {
    if (!who || !when) return

    startTransition(async () => {
      try {
        await saveAccuracyRating(repreneurId, who, when, notes || undefined)
        toast.success("Accuracy rating saved")
      } catch {
        toast.error("Failed to save accuracy rating")
      }
    })
  }

  return (
    <div className="space-y-3 pt-3 border-t border-dashed">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Target className="h-3 w-3" />
        <span>Score Accuracy</span>
        {accuracyRatedAt && (
          <span className="ml-auto text-[10px] text-muted-foreground/60">
            Rated {formatDisplayDate(accuracyRatedAt, "en-GB")}
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">WHO accuracy</Label>
          <ToggleGroup
            type="single"
            value={who}
            onValueChange={(v) => v && setWho(v)}
            className="grid grid-cols-3 gap-1"
          >
            {SCORING_ACCURACY_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                size="sm"
                className="h-7 w-full px-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">WHEN accuracy</Label>
          <ToggleGroup
            type="single"
            value={when}
            onValueChange={(v) => v && setWhen(v)}
            className="grid grid-cols-3 gap-1"
          >
            {SCORING_ACCURACY_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                size="sm"
                className="h-7 w-full px-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <Textarea
        placeholder="Optional notes on scoring accuracy..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="text-xs min-h-[60px] resize-none"
      />

      {canSave && (
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="h-7 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          {isPending ? "Saving..." : "Save Rating"}
        </Button>
      )}
    </div>
  )
}
