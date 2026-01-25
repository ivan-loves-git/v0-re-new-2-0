"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FlagBadges } from "../flag-badges"
import {
  DualScoreData,
  getScoreColor,
  getRecommendationLabel,
  getRecommendationColor,
} from "../types"

interface CardVariantDProps {
  data: DualScoreData
  title?: string
}

// Variant D: Simple number boxes with color coding
export function CardVariantD({ data, title = "Scoring" }: CardVariantDProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {data.flags.length > 0 && <FlagBadges flags={data.flags} compact />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Two score boxes side by side */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreBox label="WHO" score={data.who} subtitle="Profile Quality" />
          <ScoreBox label="WHEN" score={data.when} subtitle="Project Maturity" />
        </div>

        {/* Recommendation badge - centered and prominent */}
        <div className="flex justify-center pt-2">
          <span
            className={`px-4 py-2 text-sm font-semibold rounded-lg border ${getRecommendationColor(
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

function ScoreBox({
  label,
  score,
  subtitle,
}: {
  label: string
  score: number | null
  subtitle: string
}) {
  const getBgColor = (s: number | null) => {
    if (s === null) return "bg-gray-50 border-gray-200"
    if (s >= 80) return "bg-green-50 border-green-200"
    if (s >= 60) return "bg-blue-50 border-blue-200"
    if (s >= 40) return "bg-amber-50 border-amber-200"
    return "bg-red-50 border-red-200"
  }

  return (
    <div
      className={`flex flex-col items-center p-4 rounded-xl border-2 ${getBgColor(
        score
      )}`}
    >
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-4xl font-bold mt-1 ${getScoreColor(score)}`}>
        {score !== null ? score : "—"}
      </span>
      <span className="text-xs text-gray-500 mt-1">{subtitle}</span>
    </div>
  )
}
