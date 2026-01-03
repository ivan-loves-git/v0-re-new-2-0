"use client"

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon } from "lucide-react"
import type { Repreneur } from "@/lib/types/repreneur"
import {
  calculateExperienceScore,
  calculateLeadershipScore,
  calculateMAKnowledgeScore,
  calculateReadinessScore,
  calculateFinancialScore,
} from "@/lib/scoring-utils"

interface CandidateRadarChartProps {
  repreneur: Repreneur
}

interface RadarDataPoint {
  dimension: string
  score: number
  fullMark: 100
  description: string
}

export function CandidateRadarChart({ repreneur }: CandidateRadarChartProps) {
  const data: RadarDataPoint[] = [
    {
      dimension: "Experience",
      score: calculateExperienceScore(repreneur),
      fullMark: 100,
      description: "Based on years of experience, employment status, and industry sectors",
    },
    {
      dimension: "Leadership",
      score: calculateLeadershipScore(repreneur),
      fullMark: 100,
      description: "Based on team size managed, executive roles, and board experience",
    },
    {
      dimension: "M&A Knowledge",
      score: calculateMAKnowledgeScore(repreneur),
      fullMark: 100,
      description: "Based on prior M&A experience and involvement in transactions",
    },
    {
      dimension: "Readiness",
      score: calculateReadinessScore(repreneur),
      fullMark: 100,
      description: "Based on journey stage and identified acquisition targets",
    },
    {
      dimension: "Financial",
      score: calculateFinancialScore(repreneur),
      fullMark: 100,
      description: "Based on investment capacity and funding status",
    },
  ]

  // Check if we have any data to display
  const hasData = data.some((d) => d.score > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="h-5 w-5" />
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickCount={5}
                />
                <Radar
                  name="Profile Score"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    maxWidth: "250px",
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload as RadarDataPoint
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                          <p className="font-medium text-gray-900">{dataPoint.dimension}</p>
                          <p className="text-lg font-bold text-blue-600">{dataPoint.score} / 100</p>
                          <p className="text-xs text-gray-500 mt-1">{dataPoint.description}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Complete the questionnaire to see profile analysis
          </div>
        )}
      </CardContent>
    </Card>
  )
}
