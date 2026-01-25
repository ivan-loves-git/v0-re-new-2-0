"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FlagBadges } from "../flag-badges"
import {
  DualScoreData,
  getScoreColor,
  getRecommendationLabel,
  getRecommendationColor,
} from "../types"

interface CardVariantAProps {
  data: DualScoreData
  title?: string
}

// Variant A: Two circular gauges side by side
export function CardVariantA({ data, title = "Scoring" }: CardVariantAProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {data.flags.length > 0 && <FlagBadges flags={data.flags} compact />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Two circular gauges */}
        <div className="flex justify-center gap-8">
          <CircularGauge label="WHO" score={data.who} />
          <CircularGauge label="WHEN" score={data.when} />
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

function CircularGauge({
  label,
  score,
}: {
  label: string
  score: number | null
}) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const percentage = score !== null ? score / 100 : 0
  const strokeDashoffset = circumference * (1 - percentage)

  const getStrokeColor = (s: number | null) => {
    if (s === null) return "#d1d5db"
    if (s >= 80) return "#22c55e"
    if (s >= 60) return "#3b82f6"
    if (s >= 40) return "#f59e0b"
    return "#ef4444"
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={getStrokeColor(score)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {score !== null ? score : "—"}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
  )
}
