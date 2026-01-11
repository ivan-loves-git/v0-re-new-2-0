"use client"

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from "recharts"
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

interface Tier1DataPoint {
  dimension: string
  shortLabel: string
  score: number
  rawScore: number
  maxScore: number
  fullMark: number
  questions: string[]
  questionDetails: string
}

interface Tier2DataPoint {
  dimension: string
  shortLabel: string
  score: number
  stars: number
  fullMark: number
  weight: number
  description: string
}

export function RepreneurRadarChart({ repreneur }: RepreneurRadarChartProps) {
  const rawScores = getRawDimensionScores(repreneur)
  const tier2Dimensions = extractTier2Dimensions(repreneur)

  // Tier 1 data with detailed question mapping
  const tier1Data: Tier1DataPoint[] = [
    {
      dimension: "Experience",
      shortLabel: "Exp.",
      score: calculateExperienceScore(repreneur),
      rawScore: rawScores?.experience.score || 0,
      maxScore: DIMENSION_MAX_SCORES.experience,
      fullMark: 100,
      questions: ["Q1: Employment status", "Q2: Years experience", "Q3: Industry sectors"],
      questionDetails: "Professional background and industry expertise",
    },
    {
      dimension: "Leadership",
      shortLabel: "Lead.",
      score: calculateLeadershipScore(repreneur),
      rawScore: rawScores?.leadership.score || 0,
      maxScore: DIMENSION_MAX_SCORES.leadership,
      fullMark: 100,
      questions: ["Q5: Team size managed", "Q8: Executive roles", "Q9: Board experience"],
      questionDetails: "Management experience and executive positions",
    },
    {
      dimension: "M&A",
      shortLabel: "M&A",
      score: calculateMAKnowledgeScore(repreneur),
      rawScore: rawScores?.maKnowledge.score || 0,
      maxScore: DIMENSION_MAX_SCORES.maKnowledge,
      fullMark: 100,
      questions: ["Q4: Prior M&A experience", "Q6: Involved in M&A transactions"],
      questionDetails: "Mergers & acquisitions knowledge",
    },
    {
      dimension: "Readiness",
      shortLabel: "Ready",
      score: calculateReadinessScore(repreneur),
      rawScore: rawScores?.readiness.score || 0,
      maxScore: DIMENSION_MAX_SCORES.readiness,
      fullMark: 100,
      questions: ["Q10: Journey stage", "Q11: Target sectors", "Q12: Identified targets"],
      questionDetails: "Acquisition readiness and target clarity",
    },
    {
      dimension: "Financial",
      shortLabel: "Fin.",
      score: calculateFinancialScore(repreneur),
      rawScore: rawScores?.financial.score || 0,
      maxScore: DIMENSION_MAX_SCORES.financial,
      fullMark: 100,
      questions: ["Q14: Investment capacity", "Q15: Funding status", "Q16: Network", "Q17: Co-acquisition"],
      questionDetails: "Financial capacity and funding readiness",
    },
  ]

  // Tier 2 data with star ratings
  const tier2Data: Tier2DataPoint[] = TIER2_DIMENSIONS.map((dim) => {
    const stars = tier2Dimensions[dim.key] || 0
    return {
      dimension: dim.label,
      shortLabel: dim.label === "Financial Acumen" ? "Fin. Acumen" :
                  dim.label === "Communication" ? "Comm." :
                  dim.label === "Clarity of Vision" ? "Vision" :
                  dim.label === "Coachability" ? "Coach." :
                  dim.label === "Commitment" ? "Commit." :
                  dim.label,
      score: stars ? (stars / 5) * 100 : 0,
      stars,
      fullMark: 100,
      weight: dim.weight,
      description: dim.description,
    }
  })

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
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Tier 1: Skills */}
          <div>
            <p className="text-xs text-center text-blue-600 font-medium mb-1">T1: Skills</p>
            {hasTier1Data ? (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={tier1Data}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="shortLabel"
                      tick={{ fill: "#6b7280", fontSize: 9 }}
                    />
                    <Radar
                      dataKey="score"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.4}
                      strokeWidth={1.5}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as Tier1DataPoint
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-[240px]">
                              <p className="font-medium text-gray-900">{d.dimension}</p>
                              <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-lg font-bold text-blue-600">{d.score}%</p>
                                <p className="text-sm text-gray-500">
                                  ({d.rawScore}/{d.maxScore} pts)
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 mb-2">{d.questionDetails}</p>
                              <div className="border-t pt-2 space-y-0.5">
                                <p className="text-xs font-medium text-gray-600">Contributing questions:</p>
                                {d.questions.map((q, i) => (
                                  <p key={i} className="text-xs text-gray-500">{q}</p>
                                ))}
                              </div>
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
              <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
                Complete questionnaire
              </div>
            )}
          </div>

          {/* Tier 2: Competencies */}
          <div>
            <p className="text-xs text-center text-amber-600 font-medium mb-1">T2: Competencies</p>
            {hasTier2Data ? (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={tier2Data}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="shortLabel"
                      tick={{ fill: "#6b7280", fontSize: 9 }}
                    />
                    <Radar
                      dataKey="score"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.4}
                      strokeWidth={1.5}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as Tier2DataPoint
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-[240px]">
                              <p className="font-medium text-gray-900">{d.dimension}</p>
                              <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-lg font-bold text-amber-600">{d.stars}/5</p>
                                <span className="text-amber-500">{"★".repeat(d.stars)}{"☆".repeat(5 - d.stars)}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">Weight: {d.weight}x</p>
                              <p className="text-xs text-gray-500 mt-2">{d.description}</p>
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
              <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
                Rate competencies
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
