"use client"

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon } from "lucide-react"
import type { Repreneur } from "@/lib/types/repreneur"
import {
  calculateExperienceScore,
  calculateLeadershipScore,
  calculateMAKnowledgeScore,
  calculateReadinessScore,
  calculateFinancialScore,
  getRawDimensionScores,
  DIMENSION_MAX_SCORES,
} from "@/lib/scoring-utils"
import { TIER2_DIMENSIONS } from "@/lib/constants/tier-config"
import { extractTier2Dimensions } from "@/lib/utils/tier2-scoring"

interface RepreneurRadarChartProps {
  repreneur: Repreneur
}

interface RadarDataPoint {
  dimension: string
  score: number
  rawScore: number
  maxScore: number
  fullMark: number
  description: string
}

interface Tier2RadarDataPoint {
  dimension: string
  score: number
  fullMark: number
  weight: number
  description: string
}

export function RepreneurRadarChart({ repreneur }: RepreneurRadarChartProps) {
  const rawScores = getRawDimensionScores(repreneur)

  // Tier 1 data (Skills from questionnaire)
  const tier1Data: RadarDataPoint[] = [
    {
      dimension: "Experience",
      score: calculateExperienceScore(repreneur),
      rawScore: rawScores?.experience.score || 0,
      maxScore: DIMENSION_MAX_SCORES.experience,
      fullMark: 100,
      description: "Employment status, years of experience, and industry sectors (Q1+Q2+Q3)",
    },
    {
      dimension: "Leadership",
      score: calculateLeadershipScore(repreneur),
      rawScore: rawScores?.leadership.score || 0,
      maxScore: DIMENSION_MAX_SCORES.leadership,
      fullMark: 100,
      description: "Team size managed, executive roles, and board experience (Q5+Q8+Q9)",
    },
    {
      dimension: "M&A",
      score: calculateMAKnowledgeScore(repreneur),
      rawScore: rawScores?.maKnowledge.score || 0,
      maxScore: DIMENSION_MAX_SCORES.maKnowledge,
      fullMark: 100,
      description: "M&A transaction involvement (Q6)",
    },
    {
      dimension: "Readiness",
      score: calculateReadinessScore(repreneur),
      rawScore: rawScores?.readiness.score || 0,
      maxScore: DIMENSION_MAX_SCORES.readiness,
      fullMark: 100,
      description: "Journey stage, target sectors, identified targets (Q10+Q11+Q12)",
    },
    {
      dimension: "Financial",
      score: calculateFinancialScore(repreneur),
      rawScore: rawScores?.financial.score || 0,
      maxScore: DIMENSION_MAX_SCORES.financial,
      fullMark: 100,
      description: "Investment capacity, funding status, network, co-acquisition (Q14-Q17)",
    },
  ]

  // Tier 2 data (Competencies from interview rating)
  const tier2Dimensions = extractTier2Dimensions(repreneur)
  const tier2Data: Tier2RadarDataPoint[] = TIER2_DIMENSIONS.map((dim) => ({
    dimension: dim.label,
    score: tier2Dimensions[dim.key] ? (tier2Dimensions[dim.key]! / 5) * 100 : 0,
    fullMark: 100,
    weight: dim.weight,
    description: dim.description,
  }))

  // Check if we have data to display
  const hasTier1Data = repreneur.tier1_score_breakdown !== null && repreneur.tier1_score_breakdown !== undefined
  const hasTier2Data = Object.values(tier2Dimensions).some(v => v !== null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="h-5 w-5" />
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier 1: Skills Chart */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Tier 1: Skills</p>
          {hasTier1Data ? (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={tier1Data}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "#9ca3af", fontSize: 9 }}
                    tickCount={3}
                  />
                  <Radar
                    name="Skills"
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
                      maxWidth: "280px",
                    }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const dataPoint = payload[0].payload as RadarDataPoint
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                            <p className="font-medium text-gray-900">{dataPoint.dimension}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-lg font-bold text-blue-600">{dataPoint.score}%</p>
                              <p className="text-sm text-gray-500">
                                ({dataPoint.rawScore}/{dataPoint.maxScore} pts)
                              </p>
                            </div>
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
            <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Complete questionnaire for skills analysis
            </div>
          )}
        </div>

        {/* Tier 2: Competencies Chart */}
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-gray-500 mb-1">Tier 2: Competencies</p>
          {hasTier2Data ? (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={tier2Data}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "#9ca3af", fontSize: 9 }}
                    tickCount={3}
                  />
                  <Radar
                    name="Competencies"
                    dataKey="score"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      maxWidth: "280px",
                    }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const dataPoint = payload[0].payload as Tier2RadarDataPoint
                        const stars = Math.round(dataPoint.score / 20) // Convert back to 1-5 scale
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                            <p className="font-medium text-gray-900">{dataPoint.dimension}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-lg font-bold text-amber-600">{stars}/5 stars</p>
                              <p className="text-xs text-gray-400">
                                (weight: {dataPoint.weight}x)
                              </p>
                            </div>
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
            <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Rate competencies for interview analysis
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
