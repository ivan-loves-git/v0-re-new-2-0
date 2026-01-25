"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FlagBadges } from "../flag-badges"
import {
  DualScoreData,
  getScoreColor,
  getScoreBgColor,
  getRecommendationLabel,
  getRecommendationColor,
} from "../types"

interface CardVariantBProps {
  data: DualScoreData
  title?: string
}

// Variant B: Two horizontal progress bars stacked
export function CardVariantB({ data, title = "Scoring" }: CardVariantBProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {data.flags.length > 0 && <FlagBadges flags={data.flags} compact />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked horizontal bars */}
        <div className="space-y-3">
          <HorizontalBar label="WHO" score={data.who} />
          <HorizontalBar label="WHEN" score={data.when} />
        </div>

        {/* Recommendation badge */}
        <div className="flex justify-center pt-2">
          <span
            className={`px-3 py-1.5 text-sm font-medium rounded-full border ${getRecommendationColor(
              data.recommendation
            )}`}
          >
            {getRecommendationLabel(data.recommendation)}
          </span>
        </div>

        {/* Incomplete data warning */}
        {data.needsDataCompletion && (
          <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-md py-1">
            Some data missing - scores may be incomplete
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function HorizontalBar({
  label,
  score,
}: {
  label: string
  score: number | null
}) {
  const percentage = score !== null ? score : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-bold ${getScoreColor(score)}`}>
          {score !== null ? `${score}/100` : "—"}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(
            score
          )}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
