"use client"

import { useState, useOptimistic, useTransition } from "react"
import { Star, ChevronDown, ChevronUp, Check } from "lucide-react"
import { setTier2Dimensions } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Tier2Dimensions, Tier2DimensionKey } from "@/lib/types/repreneur"
import { TIER2_DIMENSIONS, TIER2_PASS_THRESHOLD } from "@/lib/constants/tier-config"
import { calculateTier2Overall, extractTier2Dimensions } from "@/lib/utils/tier2-scoring"

interface Tier2DimensionRatingProps {
  repreneurId: string
  repreneur: {
    tier2_leadership?: number | null
    tier2_financial_acumen?: number | null
    tier2_communication?: number | null
    tier2_clarity_of_vision?: number | null
    tier2_coachability?: number | null
    tier2_commitment?: number | null
    tier2_overall?: number | null
    tier2_stars?: number | null // Legacy field for display
  }
}

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const displayValue = hovered ?? value ?? 0

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className={cn(
            "p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              star <= displayValue
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function Tier2DimensionRating({ repreneurId, repreneur }: Tier2DimensionRatingProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Extract current dimensions
  const currentDimensions = extractTier2Dimensions(repreneur)
  const currentOverall = repreneur.tier2_overall ?? calculateTier2Overall(currentDimensions)

  // Optimistic state for dimensions
  const [optimisticDimensions, setOptimisticDimensions] = useOptimistic(
    currentDimensions,
    (state, update: Partial<Tier2Dimensions>) => ({
      ...state,
      ...update,
    })
  )

  const optimisticOverall = calculateTier2Overall(optimisticDimensions)
  const hasPassed = optimisticOverall !== null && optimisticOverall >= TIER2_PASS_THRESHOLD
  const ratedCount = Object.values(optimisticDimensions).filter((v) => v !== null).length

  async function handleDimensionChange(key: Tier2DimensionKey, value: number) {
    const update = { [key]: value }

    startTransition(async () => {
      setOptimisticDimensions(update)

      try {
        await setTier2Dimensions(repreneurId, {
          ...optimisticDimensions,
          ...update,
        })
      } catch (error) {
        console.error("Failed to update dimension:", error)
        toast.error("Failed to save rating")
      }
    })
  }

  // Display value (use legacy tier2_stars if no dimensions set yet)
  const displayOverall = optimisticOverall ?? repreneur.tier2_stars ?? null
  const displayStars = displayOverall ? Math.round(displayOverall) : 0

  return (
    <div className="space-y-3">
      {/* Collapsed View - Overall Stars */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2 -m-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">
              {displayOverall !== null ? displayOverall.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-gray-500">/5 overall</span>
            <div className="flex items-center gap-0.5 ml-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-4 w-4",
                    star <= displayStars
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-gray-200"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasPassed && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                Pass
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {ratedCount === 0
            ? "Click to rate 6 competency dimensions"
            : ratedCount < 6
            ? `${ratedCount}/6 dimensions rated - click to complete`
            : "Click to adjust ratings"}
        </p>
      </button>

      {/* Expanded View - All 6 Dimensions */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t">
          <TooltipProvider>
            {TIER2_DIMENSIONS.map((dim) => (
              <div
                key={dim.key}
                className="flex items-center justify-between py-1"
              >
                <div className="flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium cursor-help">
                        {dim.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p>{dim.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Weight: {dim.weight}x
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <StarPicker
                  value={optimisticDimensions[dim.key]}
                  onChange={(value) => handleDimensionChange(dim.key, value)}
                  disabled={isPending}
                />
              </div>
            ))}
          </TooltipProvider>

          {/* Overall Score Summary */}
          <div className="pt-3 border-t flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Weighted Overall
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {optimisticOverall !== null
                  ? optimisticOverall.toFixed(2)
                  : "—"}
              </span>
              {hasPassed ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                  Pass
                </Badge>
              ) : optimisticOverall !== null ? (
                <Badge variant="outline" className="text-xs">
                  Below {TIER2_PASS_THRESHOLD}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
