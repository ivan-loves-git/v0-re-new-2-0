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

interface CardVariantCProps {
  data: DualScoreData
  title?: string
}

// Variant C: Two vertical bars side by side (like equalizer)
export function CardVariantC({ data, title = "Scoring" }: CardVariantCProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {data.flags.length > 0 && <FlagBadges flags={data.flags} compact />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Two vertical bars */}
        <div className="flex justify-center gap-8">
          <VerticalBar label="WHO" score={data.who} />
          <VerticalBar label="WHEN" score={data.when} />
        </div>

        {/* Recommendation badge */}
        <div className="flex justify-center">
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

function VerticalBar({
  label,
  score,
}: {
  label: string
  score: number | null
}) {
  const percentage = score !== null ? score : 0

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Score value on top */}
      <span className={`text-xl font-bold ${getScoreColor(score)}`}>
        {score !== null ? score : "—"}
      </span>

      {/* Vertical bar container */}
      <div className="relative w-12 h-28 bg-gray-100 rounded-lg overflow-hidden">
        {/* Grid lines for reference */}
        <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-px bg-gray-200" />
          ))}
        </div>

        {/* Fill bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-b-lg transition-all duration-500 ${getScoreBgColor(
            score
          )}`}
          style={{ height: `${percentage}%` }}
        />
      </div>

      {/* Label */}
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
  )
}
