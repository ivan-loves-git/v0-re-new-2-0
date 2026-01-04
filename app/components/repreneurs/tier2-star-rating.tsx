"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { setTier2Stars, clearTier2Stars } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Tier2StarRatingProps {
  repreneurId: string
  currentStars: number | null | undefined
}

// Get description label based on star rating
function getStarDescription(stars: number): string {
  switch (stars) {
    case 1:
      return "Weak candidate"
    case 2:
      return "Below average"
    case 3:
      return "Average candidate"
    case 4:
      return "Strong candidate"
    case 5:
      return "Excellent candidate"
    default:
      return "Not rated"
  }
}

export function Tier2StarRating({ repreneurId, currentStars }: Tier2StarRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleStarClick(stars: number) {
    setIsUpdating(true)
    try {
      await setTier2Stars(repreneurId, stars)
      toast.success("Rating saved")
    } catch (error) {
      console.error("Failed to set star rating:", error)
      toast.error("Failed to save rating. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleClear() {
    setIsUpdating(true)
    try {
      await clearTier2Stars(repreneurId)
      toast.success("Rating cleared")
    } catch (error) {
      console.error("Failed to clear star rating:", error)
      toast.error("Failed to clear rating. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const displayStars = hoveredStar ?? currentStars ?? 0
  const hasRating = currentStars !== null && currentStars !== undefined

  return (
    <div className="space-y-3">
      {hasRating ? (
        <>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{currentStars}/5</span>
            <span className="text-sm text-gray-500">stars</span>
            <div className="flex items-center gap-1 ml-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className={cn(
                    "p-0 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded",
                    isUpdating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      star <= displayStars
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-gray-200"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getStarDescription(currentStars)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isUpdating}
              className="text-xs text-gray-400 hover:text-gray-600 h-6 px-2"
            >
              Clear
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-gray-300">—/5</span>
            <span className="text-sm text-gray-500">stars</span>
            <div className="flex items-center gap-1 ml-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className={cn(
                    "p-0 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded",
                    isUpdating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      star <= displayStars
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-gray-200"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Click a star to rate after interview
          </p>
        </>
      )}
    </div>
  )
}
