"use client"

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
  calculateT1FromV2,
  DIMENSION_MAX_SCORES,
} from "@/lib/scoring-utils"
import { TIER2_DIMENSIONS } from "@/lib/constants/tier-config"
import { extractTier2Dimensions } from "@/lib/utils/tier2-scoring"
import { WaveRadarChart } from "@/components/wave/charts"

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

  // Check for V2 questionnaire data (WHO/WHEN scores)
  const hasV2Data = repreneur.who_score_breakdown !== null && repreneur.who_score_breakdown !== undefined
  const v2Scores = hasV2Data && !rawScores
    ? calculateT1FromV2(repreneur.who_score_breakdown, repreneur.when_score_breakdown)
    : null

  // Use V2 data if available and no old tier1 breakdown exists
  const useV2 = v2Scores?.hasTier1Data && !rawScores

  // Tier 1 data with detailed question mapping
  const tier1Data: Tier1DataPoint[] = useV2 ? [
    // V2 data mapping
    {
      dimension: "Experience",
      shortLabel: "Exp.",
      score: v2Scores!.scores.experience,
      rawScore: v2Scores!.rawScores.experience.score,
      maxScore: v2Scores!.rawScores.experience.max,
      fullMark: 100,
      questions: ["Q05: Professional status", "Q06: Years experience"],
      questionDetails: "Professional background (WHO score)",
    },
    {
      dimension: "Leadership",
      shortLabel: "Lead.",
      score: v2Scores!.scores.leadership,
      rawScore: v2Scores!.rawScores.leadership.score,
      maxScore: v2Scores!.rawScores.leadership.max,
      fullMark: 100,
      questions: ["Q07: Management level"],
      questionDetails: "Leadership experience (WHO score)",
    },
    {
      dimension: "M&A",
      shortLabel: "M&A",
      score: v2Scores!.scores.maKnowledge,
      rawScore: v2Scores!.rawScores.maKnowledge.score,
      maxScore: v2Scores!.rawScores.maKnowledge.max,
      fullMark: 100,
      questions: ["Q08: Crisis management", "Q09: Investment experience"],
      questionDetails: "M&A readiness indicators (WHO score)",
    },
    {
      dimension: "Readiness",
      shortLabel: "Ready",
      score: v2Scores!.scores.readiness,
      rawScore: v2Scores!.rawScores.readiness.score,
      maxScore: v2Scores!.rawScores.readiness.max,
      fullMark: 100,
      questions: ["Q11: Project status"],
      questionDetails: "Project maturity (WHEN score)",
    },
    {
      dimension: "Financial",
      shortLabel: "Fin.",
      score: v2Scores!.scores.financial,
      rawScore: v2Scores!.rawScores.financial.score,
      maxScore: v2Scores!.rawScores.financial.max,
      fullMark: 100,
      questions: ["Financial fit", "Project clarity"],
      questionDetails: "Financial readiness (WHEN score)",
    },
  ] : [
    // Original tier1 breakdown data
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

  const hasTier1Data = (repreneur.tier1_score_breakdown !== null && repreneur.tier1_score_breakdown !== undefined) || useV2
  const hasTier2Data = Object.values(tier2Dimensions).some(v => v !== null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="size-5" />
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Tier 1: Skills */}
          <div>
            <p className="text-xs text-center text-blue-600 font-medium mb-1">T1: Skills</p>
            {hasTier1Data ? (
              <WaveRadarChart
                data={tier1Data}
                label="Tier 1 skills profile"
                categoryKey="shortLabel"
                series={[{ key: "score", label: "Skills", color: "var(--chart-1)" }]}
                className="h-[180px]"
              />
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
              <WaveRadarChart
                data={tier2Data}
                label="Tier 2 competency profile"
                categoryKey="shortLabel"
                series={[{ key: "score", label: "Competencies", color: "var(--chart-3)" }]}
                className="h-[180px]"
              />
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
