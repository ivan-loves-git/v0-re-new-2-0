"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { setTier2Stars, clearTier2Stars } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Tier2StarRatingProps {
  repreneurId: string
  currentStars: number | null | undefined
}

export function Tier2StarRating({ repreneurId, currentStars }: Tier2StarRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleStarClick(stars: number) {
    setIsUpdating(true)
    try {
      await setTier2Stars(repreneurId, stars)
    } catch (error) {
      console.error("Failed to set star rating:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleClear() {
    setIsUpdating(true)
    try {
      await clearTier2Stars(repreneurId)
    } catch (error) {
      console.error("Failed to clear star rating:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const displayStars = hoveredStar ?? currentStars ?? 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={isUpdating}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(null)}
            className={cn(
              "p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded",
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                star <= displayStars
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-gray-300"
              )}
            />
          </button>
        ))}
      </div>
      {currentStars && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Rating: {currentStars}/5
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isUpdating}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </Button>
        </div>
      )}
      {!currentStars && (
        <p className="text-xs text-gray-400">
          Click a star to rate (auto-qualifies)
        </p>
      )}
    </div>
  )
}
